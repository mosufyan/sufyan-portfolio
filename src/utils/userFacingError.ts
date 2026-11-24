/**
 * Map raw SDK / API failures to short visitor-safe copy.
 * Never surface JSON blobs, UIDs, emails, paths, or stack traces in the UI.
 */

const MAX_LEN = 180;

const CODE_MESSAGES: Record<string, string> = {
  'permission-denied':
    'Save was blocked by Firestore security rules. If you’re already signed in as the primary owner, the live rules may be out of date or the settings payload failed validation — deploy the latest firestore.rules and try again.',
  'unauthenticated': 'Please sign in again to continue.',
  'unavailable': 'Service temporarily unavailable. Check your connection and try again.',
  'deadline-exceeded': 'That request timed out. Please try again.',
  'resource-exhausted': 'Too many requests right now. Please wait a moment and try again.',
  'not-found': 'That item was not found. Refresh and try again.',
  'already-exists': 'That item already exists.',
  'failed-precondition': 'That action isn’t available right now. Refresh and try again.',
  'aborted': 'That update conflicted with another change. Refresh and try again.',
  cancelled: 'Request cancelled.',
  'data-loss': 'Something went wrong saving data. Please try again.',
  'invalid-argument': 'Some of the values look invalid. Check the form and try again.',
  'network-request-failed': 'Network error. Check your connection and try again.',
  offline: 'You’re offline. Reconnect and try again.',
};

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^firestore\//, '')
    .replace(/^auth\//, '')
    .replace(/^storage\//, '')
    .replace(/^functions\//, '');
}

function extractCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
    return normalizeCode((error as { code: string }).code);
  }
  return '';
}

function extractRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message || '';
  if (typeof error === 'string') return error;
  return '';
}

function unwrapJsonErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return message;
  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
  } catch {
    /* not JSON */
  }
  return '';
}

function looksLikeInternalLeak(text: string): boolean {
  return (
    text.includes('{') ||
    text.includes('}') ||
    /authInfo|operationType|userId|tenantId|providerInfo|stack|firestore\.googleapis/i.test(
      text
    ) ||
    /portfolio_settings|access_rules|admin_audit|contact_messages|cv_downloads/i.test(text) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) ||
    /\buid\b|\/[a-z0-9_-]+\/[a-z0-9_-]+/i.test(text)
  );
}

function messageFromHints(haystack: string): string | null {
  const h = haystack.toLowerCase();
  if (
    h.includes('insufficient permissions') ||
    h.includes('permission-denied') ||
    h.includes('permission_denied') ||
    h.includes('missing or insufficient permissions')
  ) {
    return CODE_MESSAGES['permission-denied'];
  }
  // Legacy JSON wrapper from older handleFirestoreError builds
  if (h.includes('missing or insufficient')) {
    return CODE_MESSAGES['permission-denied'];
  }
  if (h.includes('offline') || h.includes('failed to get document because the client is offline')) {
    return CODE_MESSAGES.offline;
  }
  if (h.includes('network') || h.includes('fetch failed') || h.includes('failed to fetch')) {
    return CODE_MESSAGES['network-request-failed'];
  }
  if (h.includes('too many') || h.includes('rate limit') || h.includes('429')) {
    return CODE_MESSAGES['resource-exhausted'];
  }
  if (h.includes('unauthenticated') || h.includes('auth/')) {
    return CODE_MESSAGES.unauthenticated;
  }
  if (h.includes('not found') || h.includes('404')) {
    return CODE_MESSAGES['not-found'];
  }
  if (h.includes('timed out') || h.includes('timeout')) {
    return CODE_MESSAGES['deadline-exceeded'];
  }
  if (
    h.includes('voice endpoints') ||
    h.includes('lacks the permissions') ||
    h.includes('add the permissions') ||
    (h.includes('console.x.ai') && h.includes('voice'))
  ) {
    return 'Grok voice APIs are not enabled on this API key. In console.x.ai, edit the key and add Voice permissions, then retry.';
  }
  return null;
}

/**
 * Convert any thrown value into a short, safe message for UI banners.
 */
export function toUserFacingError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  const code = extractCode(error);
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const raw = extractRawMessage(error);
  const unwrapped = unwrapJsonErrorMessage(raw);
  const candidate = unwrapped || raw;
  const hinted = messageFromHints(`${code} ${candidate} ${raw}`);
  if (hinted) return hinted;

  if (!candidate || looksLikeInternalLeak(candidate)) {
    return fallback;
  }

  const cleaned = candidate.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 3 || cleaned.length > MAX_LEN) return fallback;
  return cleaned;
}
