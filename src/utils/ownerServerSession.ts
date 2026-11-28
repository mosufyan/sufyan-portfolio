/** Browser helpers for Firebase session-cookie owner console auth. */

export type OwnerSessionStatus = {
  ok: boolean;
  via?: 'session' | 'idToken';
  role?: 'owner' | 'delegate';
  idleRemainingMs?: number | null;
  absoluteRemainingMs?: number | null;
  warn?: boolean;
  error?: string;
  code?: string;
};

export async function establishOwnerServerSession(idToken: string): Promise<OwnerSessionStatus> {
  const res = await fetch('/api/owner/session/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = (await res.json().catch(() => ({}))) as OwnerSessionStatus;
  if (!res.ok) {
    return { ...data, ok: false, error: data.error || 'Unable to create owner session.' };
  }
  return { ...data, ok: true };
}

export async function fetchOwnerSessionStatus(): Promise<OwnerSessionStatus> {
  const res = await fetch('/api/owner/session/status', { credentials: 'include' });
  const data = (await res.json().catch(() => ({}))) as OwnerSessionStatus;
  if (!res.ok) {
    return { ...data, ok: false, error: data.error || 'Session status unavailable.' };
  }
  return { ...data, ok: true };
}

export async function touchOwnerServerSession(): Promise<OwnerSessionStatus> {
  const res = await fetch('/api/owner/session/touch', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = (await res.json().catch(() => ({}))) as OwnerSessionStatus;
  if (!res.ok) {
    return { ...data, ok: false, error: data.error || 'Unable to refresh session.' };
  }
  return { ...data, ok: true };
}

export async function logoutOwnerServerSession(): Promise<void> {
  try {
    await fetch('/api/owner/session/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      keepalive: true,
    });
  } catch {
    /* non-fatal */
  }
}
