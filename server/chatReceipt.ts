/**
 * Helpers for authenticated live-chat session receipts.
 * Prefer request headers over body/query so tokens stay out of URLs and logs.
 */

export function extractChatReceipt(input: {
  headers?: Record<string, string | string[] | undefined>;
  bodyReceipt?: unknown;
  queryReceipt?: unknown;
  allowQuery?: boolean;
}): string | undefined {
  const headers = input.headers || {};
  const headerRaw = headers['x-chat-receipt'];
  const header =
    typeof headerRaw === 'string'
      ? headerRaw
      : Array.isArray(headerRaw)
        ? headerRaw[0]
        : undefined;
  if (typeof header === 'string' && header.trim()) return header.trim();

  const authRaw = headers.authorization;
  const auth =
    typeof authRaw === 'string'
      ? authRaw
      : Array.isArray(authRaw)
        ? authRaw[0]
        : undefined;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('chat-receipt ')) {
    const token = auth.slice('chat-receipt '.length).trim();
    if (token) return token;
  }

  if (typeof input.bodyReceipt === 'string' && input.bodyReceipt.trim()) {
    return input.bodyReceipt.trim();
  }

  // Query receipts leak via access logs / Referer — disabled by default.
  if (
    input.allowQuery &&
    typeof input.queryReceipt === 'string' &&
    input.queryReceipt.trim()
  ) {
    return input.queryReceipt.trim();
  }

  return undefined;
}
