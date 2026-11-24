# Voice model Site Controls

**Date:** 2026-11-23  
**Status:** Approved

## Goal

Expose push-to-talk and live speech-to-speech model/voice settings in the owner Site Controls console, mirroring the existing text `chatLlmModel` field.

## Fields

| UI label | Policy key | Empty default |
|---|---|---|
| Push-to-talk STT model | `voiceSttModel` | `grok-voice-transcribe-2.0` (env/server) |
| TTS voice id | `voiceTtsVoiceId` | `eve` |
| Live S2S model | `voiceRealtimeModel` | `grok-voice-3.0` |

## Behavior

- Empty string uses current env/server defaults.
- Sanitize length ≤ 64; allow safe model/voice id characters only.
- Persist via owner policy sync (Firebase → `/api/owner/policy-sync` → runtime + distributed store).
- Not included in public visitor settings slice.
- API key, base URL, timeouts remain `.env` only.
- Text chat `chatLlmModel` unchanged.

## UI

Three inputs under the existing Grok model id field in `ChatConfigFields`.
