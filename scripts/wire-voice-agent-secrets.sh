#!/usr/bin/env bash
# Wire Groq STT + optional ElevenLabs TTS secrets into Secret Manager and Cloud Run.
# Loads values from the environment (or from .env if present in cwd).
#
# Usage:
#   ./scripts/wire-voice-agent-secrets.sh
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

if [[ -z "${GROQ_API_KEY:-}" ]]; then
  echo "Missing GROQ_API_KEY. Set it in the environment or .env" >&2
  exit 1
fi

GROQ_API_BASE_URL="${GROQ_API_BASE_URL:-https://api.groq.com/openai/v1}"
GROQ_STT_MODEL="${GROQ_STT_MODEL:-whisper-large-v3-turbo}"
VOICE_STT_TIMEOUT_MS="${VOICE_STT_TIMEOUT_MS:-20000}"
ELEVENLABS_API_BASE_URL="${ELEVENLABS_API_BASE_URL:-https://api.elevenlabs.io/v1}"
ELEVENLABS_MODEL_ID="${ELEVENLABS_MODEL_ID:-eleven_flash_v2_5}"
VOICE_TTS_TIMEOUT_MS="${VOICE_TTS_TIMEOUT_MS:-15000}"

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

upsert_secret GROQ_API_KEY "$GROQ_API_KEY"
upsert_secret GROQ_API_BASE_URL "$GROQ_API_BASE_URL"
upsert_secret GROQ_STT_MODEL "$GROQ_STT_MODEL"
upsert_secret VOICE_STT_TIMEOUT_MS "$VOICE_STT_TIMEOUT_MS"

secret_bindings="GROQ_API_KEY=GROQ_API_KEY:latest,GROQ_API_BASE_URL=GROQ_API_BASE_URL:latest,GROQ_STT_MODEL=GROQ_STT_MODEL:latest,VOICE_STT_TIMEOUT_MS=VOICE_STT_TIMEOUT_MS:latest"

if [[ -n "${ELEVENLABS_API_KEY:-}" ]]; then
  upsert_secret ELEVENLABS_API_KEY "$ELEVENLABS_API_KEY"
  upsert_secret ELEVENLABS_API_BASE_URL "$ELEVENLABS_API_BASE_URL"
  upsert_secret ELEVENLABS_MODEL_ID "$ELEVENLABS_MODEL_ID"
  upsert_secret VOICE_TTS_TIMEOUT_MS "$VOICE_TTS_TIMEOUT_MS"
  secret_bindings+=",ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest,ELEVENLABS_API_BASE_URL=ELEVENLABS_API_BASE_URL:latest,ELEVENLABS_MODEL_ID=ELEVENLABS_MODEL_ID:latest,VOICE_TTS_TIMEOUT_MS=VOICE_TTS_TIMEOUT_MS:latest"
  if [[ -n "${ELEVENLABS_VOICE_ID:-}" ]]; then
    upsert_secret ELEVENLABS_VOICE_ID "$ELEVENLABS_VOICE_ID"
    secret_bindings+=",ELEVENLABS_VOICE_ID=ELEVENLABS_VOICE_ID:latest"
  fi
fi

gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --update-secrets="${secret_bindings}" \
  --quiet

echo "Attached voice agent secrets to Cloud Run service ${SERVICE}."
echo "Enable enableVoiceAgent in Owner Console, then check:"
echo "  curl -sS https://www.mohammedsufyan.com/api/chat/status | jq '{voiceAgentAvailable,voiceSttConfigured,voiceTtsConfigured}'"
