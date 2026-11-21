/**
 * Public Vite client keys. Values come from `vitePublicEnv.generated.ts`,
 * which vite.config.ts rewrites from process.env / .env on every Vite run.
 */
import {
  GENERATED_VITE_FIREBASE_API_KEY,
  GENERATED_VITE_RECAPTCHA_SITE_KEY,
  GENERATED_VITE_TURNSTILE_SITE_KEY,
} from './vitePublicEnv.generated.ts';

export function viteFirebaseApiKey(): string {
  return String(GENERATED_VITE_FIREBASE_API_KEY || '').trim();
}

export function viteTurnstileSiteKey(): string {
  return String(GENERATED_VITE_TURNSTILE_SITE_KEY || '').trim();
}

export function viteRecaptchaSiteKey(): string {
  return String(GENERATED_VITE_RECAPTCHA_SITE_KEY || '').trim();
}
