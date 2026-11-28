#!/usr/bin/env bash
# One-time: create a deploy SA + Workload Identity Federation for GitHub Actions → Cloud Run.
# Prints the two values to add as GitHub Actions secrets / variables.
set -euo pipefail

PROJECT="${GCP_PROJECT:-mohammed-sufyan-portfolio}"
REGION="${GCP_REGION:-us-central1}"
REPO="${GITHUB_REPO:-mosufyan/sufyan-portfolio}"
SA_NAME="${GITHUB_DEPLOY_SA:-github-actions-deploy}"
POOL_ID="${WIF_POOL_ID:-github-pool}"
PROVIDER_ID="${WIF_PROVIDER_ID:-github-provider}"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

echo "Project=${PROJECT} number=${PROJECT_NUMBER} repo=${REPO}"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT" \
    --display-name="GitHub Actions Cloud Run deploy"
fi

# Roles needed for Cloud Run image deploy + Firestore rules/indexes deploy from CI.
for ROLE in \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/cloudbuild.builds.builder \
  roles/artifactregistry.writer \
  roles/storage.admin \
  roles/secretmanager.secretAccessor \
  roles/firebaserules.admin \
  roles/datastore.indexAdmin
do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null
done

# Allow Cloud Run runtime SA to be used by deploy SA when updating the service.
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --project="$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null || true

if ! gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --project="$PROJECT" \
    --location=global \
    --display-name="GitHub Actions pool"
fi

PROVIDER_FULL="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT" --location=global --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --project="$PROJECT" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${REPO}'"
fi

POOL_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository/${REPO}" \
  --quiet >/dev/null

echo
echo "Add these to the GitHub repo (${REPO}):"
echo "  Secret  GCP_WORKLOAD_IDENTITY_PROVIDER = ${PROVIDER_FULL}"
echo "  Secret  GCP_SERVICE_ACCOUNT             = ${SA_EMAIL}"
echo "  Variable GCP_PROJECT                   = ${PROJECT}"
echo "  Variable GCP_REGION                    = ${REGION}"
echo "  Variable CLOUD_RUN_SERVICE             = mohammed-sufyan-portfolio"
echo
echo "Or run:"
echo "  gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER -R ${REPO} -b'${PROVIDER_FULL}'"
echo "  gh secret set GCP_SERVICE_ACCOUNT -R ${REPO} -b'${SA_EMAIL}'"
echo "  gh variable set GCP_PROJECT -R ${REPO} -b'${PROJECT}'"
echo "  gh variable set GCP_REGION -R ${REPO} -b'${REGION}'"
echo "  gh variable set CLOUD_RUN_SERVICE -R ${REPO} -b'mohammed-sufyan-portfolio'"
