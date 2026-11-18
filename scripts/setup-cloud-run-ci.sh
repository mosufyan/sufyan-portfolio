#!/usr/bin/env bash
# One-time GCP + GitHub setup for CI → Artifact Registry → Cloud Run deploys.
# Requires: gcloud auth login, and gh auth login (with repo admin for secrets/vars).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-elite-choir-53kqt}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-sufyan-portfolio}"
REPOSITORY="${REPOSITORY:-portfolio}"
SA_NAME="${SA_NAME:-github-cloud-run-deploy}"
POOL_NAME="${POOL_NAME:-github-actions-pool}"
PROVIDER_NAME="${PROVIDER_NAME:-github-provider}"
GITHUB_REPO="${GITHUB_REPO:-mosufyan/sufyan-portfolio}"

GCLOUD="${GCLOUD:-gcloud}"
if [[ ! -x "$(command -v "$GCLOUD" || true)" ]]; then
  if [[ -x "/Users/Sufyan/Library/Application Support/cloud-code/installer/google-cloud-sdk/bin/gcloud" ]]; then
    GCLOUD="/Users/Sufyan/Library/Application Support/cloud-code/installer/google-cloud-sdk/bin/gcloud"
  fi
fi

echo "Using gcloud: $GCLOUD"
echo "Project=$PROJECT_ID Region=$REGION Service=$SERVICE Repo=$REPOSITORY"

"$GCLOUD" config set project "$PROJECT_ID"

echo "Enabling APIs..."
"$GCLOUD" services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sts.googleapis.com

echo "Creating Artifact Registry Docker repo (if missing)..."
if ! "$GCLOUD" artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  "$GCLOUD" artifacts repositories create "$REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Portfolio Cloud Run images"
fi

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "Ensuring deploy service account $SA_EMAIL..."
if ! "$GCLOUD" iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  "$GCLOUD" iam service-accounts create "$SA_NAME" \
    --display-name="GitHub Actions Cloud Run deploy"
fi

for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser
do
  "$GCLOUD" projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --condition=None >/dev/null
done

PROJECT_NUMBER="$("$GCLOUD" projects describe "$PROJECT_ID" --format='value(projectNumber)')"
POOL_ID="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}"
PROVIDER_ID="${POOL_ID}/providers/${PROVIDER_NAME}"

echo "Ensuring Workload Identity Pool..."
if ! "$GCLOUD" iam workload-identity-pools describe "$POOL_NAME" --location=global >/dev/null 2>&1; then
  "$GCLOUD" iam workload-identity-pools create "$POOL_NAME" \
    --location=global \
    --display-name="GitHub Actions"
fi

echo "Ensuring GitHub OIDC provider..."
if ! "$GCLOUD" iam workload-identity-pools providers describe "$PROVIDER_NAME" \
  --location=global --workload-identity-pool="$POOL_NAME" >/dev/null 2>&1; then
  "$GCLOUD" iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
    --location=global \
    --workload-identity-pool="$POOL_NAME" \
    --display-name="GitHub" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
fi

echo "Binding WIF → service account (repo-scoped)..."
"$GCLOUD" iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  >/dev/null

echo "Ensuring Cloud Run service exists (will no-op update if present)..."
# Create a placeholder only if missing — first real image comes from CI.
if ! "$GCLOUD" run services describe "$SERVICE" --region="$REGION" >/dev/null 2>&1; then
  echo "Service '$SERVICE' not found in $REGION."
  echo "Create it once in Console (or deploy manually), then re-run CI."
  echo "Suggested name: $SERVICE"
fi

if command -v gh >/dev/null 2>&1; then
  echo "Writing GitHub Actions variables..."
  gh variable set ENABLE_CLOUD_RUN_DEPLOY --body "true" --repo "$GITHUB_REPO"
  gh variable set GCP_PROJECT_ID --body "$PROJECT_ID" --repo "$GITHUB_REPO"
  gh variable set GCP_REGION --body "$REGION" --repo "$GITHUB_REPO"
  gh variable set GCP_AR_LOCATION --body "$REGION" --repo "$GITHUB_REPO"
  gh variable set GCP_AR_REPOSITORY --body "$REPOSITORY" --repo "$GITHUB_REPO"
  gh variable set CLOUD_RUN_SERVICE --body "$SERVICE" --repo "$GITHUB_REPO"
  gh variable set WIF_PROVIDER --body "$PROVIDER_ID" --repo "$GITHUB_REPO"
  gh variable set WIF_SERVICE_ACCOUNT --body "$SA_EMAIL" --repo "$GITHUB_REPO"
  echo "GitHub variables set on $GITHUB_REPO"
else
  echo "gh CLI not found — set these GitHub Actions variables manually:"
  echo "  ENABLE_CLOUD_RUN_DEPLOY=true"
  echo "  GCP_PROJECT_ID=$PROJECT_ID"
  echo "  GCP_REGION=$REGION"
  echo "  GCP_AR_LOCATION=$REGION"
  echo "  GCP_AR_REPOSITORY=$REPOSITORY"
  echo "  CLOUD_RUN_SERVICE=$SERVICE"
  echo "  WIF_PROVIDER=$PROVIDER_ID"
  echo "  WIF_SERVICE_ACCOUNT=$SA_EMAIL"
fi

echo
echo "Done. Next:"
echo "  1) Ensure Cloud Run service '$SERVICE' exists in $REGION (and domain mapping if needed)."
echo "  2) Set mail env vars/secrets on the Cloud Run service (CONTACT_TO_EMAIL, GMAIL_*/RESEND_*)."
echo "  3) Merge to main — CI verify + deploy will push an image and update the service."
