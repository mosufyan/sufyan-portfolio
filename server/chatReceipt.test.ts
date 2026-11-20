import { describe, expect, it } from 'vitest';
import { extractChatReceipt } from './chatReceipt.ts';

describe('extractChatReceipt', () => {
  it('prefers X-Chat-Receipt header', () => {
    expect(
      extractChatReceipt({
        headers: {
          'x-chat-receipt': 'header-token',
          authorization: 'Chat-Receipt auth-token',
        },
        bodyReceipt: 'body-token',
        queryReceipt: 'query-token',
        allowQuery: true,
      })
    ).toBe('header-token');
  });

  it('accepts Authorization: Chat-Receipt', () => {
    expect(
      extractChatReceipt({
        headers: { authorization: 'Chat-Receipt  sess.sig ' },
        bodyReceipt: 'body-token',
      })
    ).toBe('sess.sig');
  });

  it('falls back to body receipt when headers are absent', () => {
    expect(
      extractChatReceipt({
        headers: {},
        bodyReceipt: ' body.tok ',
      })
    ).toBe('body.tok');
  });

  it('rejects query receipts by default', () => {
    expect(
      extractChatReceipt({
        headers: {},
        queryReceipt: 'query-leak',
      })
    ).toBeUndefined();
  });

  it('optionally accepts query receipts when explicitly allowed', () => {
    expect(
      extractChatReceipt({
        headers: {},
        queryReceipt: 'legacy',
        allowQuery: true,
      })
    ).toBe('legacy');
  });
});
