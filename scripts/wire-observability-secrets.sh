#!/usr/bin/env bash
# Wire SENTRY_DSN + SLACK_ALERT_WEBHOOK_URL into Secret Manager and Cloud Run.
# Usage:
#   export SENTRY_DSN='https://...@....ingest.sentry.io/...'
#   export SLACK_ALERT_WEBHOOK_URL='https://hooks.slack.com/services/...'
#   ./scripts/wire-observability-secrets.sh
set -euo pipefail

PROJECT="${GCP_PROJECT:-mohammed-sufyan-portfolio}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-mohammed-sufyan-portfolio}"

if [[ -z "${SENTRY_DSN:-}" || -z "${SLACK_ALERT_WEBHOOK_URL:-}" ]]; then
  echo "Set SENTRY_DSN and SLACK_ALERT_WEBHOOK_URL in the environment first." >&2
  exit 1
fi

SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --project="$PROJECT" --data-file=-
  else
    printf '%s' "$value" | gcloud secrets create "$name" --project="$PROJECT" --data-file=-
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --project="$PROJECT" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

upsert_secret SENTRY_DSN "$SENTRY_DSN"
upsert_secret SLACK_ALERT_WEBHOOK_URL "$SLACK_ALERT_WEBHOOK_URL"

gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --update-secrets=SENTRY_DSN=SENTRY_DSN:latest,SLACK_ALERT_WEBHOOK_URL=SLACK_ALERT_WEBHOOK_URL:latest \
  --quiet

echo "Attached. Check: curl -s https://www.mohammedsufyan.com/api/health | jq '.observability,.goldPath.score'"
