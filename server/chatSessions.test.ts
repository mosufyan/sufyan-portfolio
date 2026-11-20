import { describe, expect, it, beforeEach } from 'vitest';
import {
  appendChatMessage,
  closeChatSession,
  createChatSession,
  getChatSession,
  getChatStats,
  listChatSessions,
  publicSessionView,
  touchOwnerPresence,
} from './chatSessions.ts';

describe('chatSessions', () => {
  beforeEach(() => {
    // Close leftover open sessions from prior tests in-process.
    for (const s of listChatSessions()) {
      if (s.status !== 'closed') closeChatSession(s.sessionId);
    }
  });

  it('creates sessions with opening visitor message and public view', () => {
    const session = createChatSession({
      visitorName: 'Alex Recruiter',
      visitorEmail: 'alex@Example.com',
      ipAddress: '203.0.113.5',
      userAgent: 'vitest',
      openingMessage: 'Interested in a Principal Security role.',
    });
    expect(session.sessionId).toMatch(/^CHAT-/);
    expect(session.visitorEmail).toBe('alex@example.com');
    expect(session.messages.some((m) => m.role === 'visitor')).toBe(true);
    const view = publicSessionView(session);
    expect(view.sessionId).toBe(session.sessionId);
    expect(view.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('appends owner replies and closes sessions', () => {
    const session = createChatSession({
      visitorName: 'Pat',
      visitorEmail: 'pat@example.com',
      ipAddress: '198.51.100.2',
      userAgent: 'vitest',
    });
    const withMsg = appendChatMessage(session.sessionId, 'visitor', 'Are you free next week?');
    expect(withMsg?.messages.at(-1)?.role).toBe('visitor');
    const replied = appendChatMessage(session.sessionId, 'owner', 'Yes — happy to connect.');
    expect(replied?.status).toBe('active');
    const closed = closeChatSession(session.sessionId);
    expect(closed?.status).toBe('closed');
    expect(appendChatMessage(session.sessionId, 'visitor', 'more')).toBeNull();
    expect(getChatSession(session.sessionId)?.status).toBe('closed');
  });

  it('tracks owner presence and aggregate stats', () => {
    touchOwnerPresence(Date.now());
    const stats = getChatStats();
    expect(stats.ownerOnline).toBe(true);
    expect(typeof stats.botQuestions).toBe('number');
    expect(typeof stats.liveSessions).toBe('number');
    expect(stats.openSessions).toBeGreaterThanOrEqual(0);
  });
});
