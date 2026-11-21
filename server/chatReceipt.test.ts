import { describe, expect, it } from 'vitest';
import {
  chatSessionAuthError,
  extractChatReceipt,
  signChatSessionReceipt,
  verifyChatSessionReceipt,
} from './chatReceipt.ts';
import { SESSION_EXPIRED_CODE, VERIFIED_SESSION_TTL_MS } from './sessionPolicy.ts';

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

describe('chat session receipts', () => {
  const secret = 'chat-receipt-test-secret';

  it('signs and verifies a fresh receipt', () => {
    const receipt = signChatSessionReceipt('CHAT-1', 'visitor@example.com', secret);
    const auth = verifyChatSessionReceipt(receipt, 'CHAT-1', secret);
    expect(auth).toEqual({ ok: true, email: 'visitor@example.com' });
  });

  it('marks receipts past the verified-session TTL as expired with session_expired code', () => {
    const receipt = signChatSessionReceipt(
      'CHAT-2',
      'visitor@example.com',
      secret,
      Date.now() - VERIFIED_SESSION_TTL_MS - 5_000
    );
    const auth = verifyChatSessionReceipt(receipt, 'CHAT-2', secret);
    expect(auth).toEqual({ ok: false, reason: 'expired' });
    if (auth.ok) throw new Error('expected expired');
    expect(chatSessionAuthError(auth)).toEqual({
      error: expect.stringMatching(/verify your email again/i),
      code: SESSION_EXPIRED_CODE,
    });
  });

  it('rejects tampered receipts as invalid', () => {
    const receipt = signChatSessionReceipt('CHAT-3', 'visitor@example.com', secret);
    expect(verifyChatSessionReceipt(`${receipt}x`, 'CHAT-3', secret)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
