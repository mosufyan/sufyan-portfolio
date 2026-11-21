#!/usr/bin/env bash
# Wire Grok + Upstash Vector chat secrets into Secret Manager and Cloud Run.
# Loads values from the environment (or from .env if present in cwd).
#
# Usage:
#   ./scripts/wire-chat-llm-secrets.sh
#   # or export vars first, then run
set -euo pipefail

PROJECT="${GCP_PROJECT:-mohammed-sufyan-portfolio}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-mohammed-sufyan-portfolio}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

required=(
  GROK_API_KEY
  GROK_API_BASE_URL
  UPSTASH_VECTOR_REST_URL
  UPSTASH_VECTOR_REST_TOKEN
)

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing ${name}. Set it in the environment or .env" >&2
    exit 1
  fi
done

CHAT_LLM_TIMEOUT_MS="${CHAT_LLM_TIMEOUT_MS:-12000}"

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

upsert_secret GROK_API_KEY "$GROK_API_KEY"
upsert_secret GROK_API_BASE_URL "$GROK_API_BASE_URL"
upsert_secret UPSTASH_VECTOR_REST_URL "$UPSTASH_VECTOR_REST_URL"
upsert_secret UPSTASH_VECTOR_REST_TOKEN "$UPSTASH_VECTOR_REST_TOKEN"
upsert_secret CHAT_LLM_TIMEOUT_MS "$CHAT_LLM_TIMEOUT_MS"

gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --update-secrets=GROK_API_KEY=GROK_API_KEY:latest,GROK_API_BASE_URL=GROK_API_BASE_URL:latest,UPSTASH_VECTOR_REST_URL=UPSTASH_VECTOR_REST_URL:latest,UPSTASH_VECTOR_REST_TOKEN=UPSTASH_VECTOR_REST_TOKEN:latest,CHAT_LLM_TIMEOUT_MS=CHAT_LLM_TIMEOUT_MS:latest \
  --quiet

echo "Attached chat LLM + vector secrets to Cloud Run service ${SERVICE}."
echo "Check: curl -sS https://www.mohammedsufyan.com/api/chat/status | jq '{llmConfigured,vectorConfigured}'"
