/**
 * Shared visitor verification TTLs for OTP challenges and signed session receipts.
 */

/** Time allowed to enter an email OTP after challenge creation. */
export const OTP_CHALLENGE_TTL_MS = 10 * 60 * 1000;

/**
 * Absolute lifetime for CV / PWA / chat verified sessions after OTP success.
 * Aligns signed receipt max-age with Redis chat session TTL.
 */
export const VERIFIED_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const SESSION_EXPIRED_CODE = 'session_expired' as const;

export const SESSION_EXPIRED_MESSAGES = {
  cv: 'Session verification expired. Please re-verify.',
  chat: 'Your verified session expired. Please verify your email again to continue.',
  chatGeneric: 'Invalid or expired chat session. Please verify your email again.',
} as const;
