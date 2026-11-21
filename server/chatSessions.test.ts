import { describe, expect, it, beforeEach } from 'vitest';
import {
  appendChatMessage,
  clearOwnerPresence,
  closeChatSession,
  createChatSession,
  getChatSession,
  getChatStats,
  isOwnerOnline,
  listChatSessions,
  publicSessionView,
  startNewChatThread,
  touchOwnerPresence,
} from './chatSessions.ts';

describe('chatSessions', () => {
  beforeEach(() => {
    // Close leftover open sessions from prior tests in-process.
    for (const s of listChatSessions()) {
      if (s.status !== 'closed') closeChatSession(s.sessionId);
    }
  });

  it('creates sessions with welcome, customer fields, and public view', () => {
    const session = createChatSession({
      visitorName: 'Alex Recruiter',
      visitorEmail: 'alex@Example.com',
      ipAddress: '203.0.113.5',
      userAgent: 'vitest',
      company: 'Cisco',
      interest: 'Principal Security',
      openingMessage: 'Interested in a Principal Security role.',
    });
    expect(session.sessionId).toMatch(/^CHAT-/);
    expect(session.visitorEmail).toBe('alex@example.com');
    expect(session.company).toBe('Cisco');
    expect(session.interest).toBe('Principal Security');
    expect(session.messages.some((m) => m.role === 'system')).toBe(true);
    expect(session.messages.some((m) => m.role === 'visitor')).toBe(true);
    const view = publicSessionView(session);
    expect(view.sessionId).toBe(session.sessionId);
    expect(view.company).toBe('Cisco');
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

  it('clears owner online immediately on explicit offline', () => {
    touchOwnerPresence(Date.now());
    expect(isOwnerOnline()).toBe(true);
    clearOwnerPresence();
    expect(isOwnerOnline()).toBe(false);
  });

  it('starts a new visitor thread while keeping prior messages for the owner', () => {
    const session = createChatSession({
      visitorName: 'Sam Visitor',
      visitorEmail: 'sam@example.com',
      ipAddress: '203.0.113.9',
      userAgent: 'vitest',
    });
    appendChatMessage(session.sessionId, 'visitor', 'What certifications does he hold?');
    appendChatMessage(session.sessionId, 'bot', 'AWS, Azure, and more.');
    const beforeCount = getChatSession(session.sessionId)?.messages.length || 0;
    const reset = startNewChatThread(session.sessionId);
    expect(reset).not.toBeNull();
    expect(reset!.messages.length).toBeGreaterThan(beforeCount);
    const visitorView = publicSessionView(reset!, { threadOnly: true });
    const ownerView = publicSessionView(reset!);
    expect(visitorView.messages.some((m) => m.text.includes('What certifications does he hold?'))).toBe(
      false
    );
    expect(visitorView.messages.some((m) => /new chat started/i.test(m.text))).toBe(true);
    expect(ownerView.messages.some((m) => m.text.includes('What certifications does he hold?'))).toBe(
      true
    );
    expect(ownerView.messages.length).toBeGreaterThan(visitorView.messages.length);
  });
});
