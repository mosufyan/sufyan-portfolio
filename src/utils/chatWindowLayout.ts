/** Persistable size for the portfolio chat panel (desktop / large screens). */

export const CHAT_WINDOW_SIZE_KEY = 'ms_chat_window_size_v1';

export const CHAT_WINDOW_DEFAULT = { width: 480, height: 608 } as const;
export const CHAT_WINDOW_MIN = { width: 320, height: 380 } as const;

export interface ChatWindowSize {
  width: number;
  height: number;
}

export function clampChatWindowSize(
  size: Partial<ChatWindowSize>,
  viewport: { width: number; height: number } = {
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }
): ChatWindowSize {
  const maxW = Math.max(CHAT_WINDOW_MIN.width, viewport.width - 24);
  const maxH = Math.max(CHAT_WINDOW_MIN.height, viewport.height - 88);
  const width = Math.min(
    maxW,
    Math.max(CHAT_WINDOW_MIN.width, Math.round(size.width ?? CHAT_WINDOW_DEFAULT.width))
  );
  const height = Math.min(
    maxH,
    Math.max(CHAT_WINDOW_MIN.height, Math.round(size.height ?? CHAT_WINDOW_DEFAULT.height))
  );
  return { width, height };
}

export function expandedChatWindowSize(viewport: {
  width: number;
  height: number;
}): ChatWindowSize {
  return clampChatWindowSize(
    {
      width: Math.min(viewport.width - 24, Math.max(640, Math.floor(viewport.width * 0.72))),
      height: viewport.height - 88,
    },
    viewport
  );
}

export function loadChatWindowSize(): ChatWindowSize {
  try {
    const raw = window.localStorage.getItem(CHAT_WINDOW_SIZE_KEY);
    if (!raw) return { ...CHAT_WINDOW_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<ChatWindowSize>;
    return clampChatWindowSize(parsed);
  } catch {
    return { ...CHAT_WINDOW_DEFAULT };
  }
}

export function saveChatWindowSize(size: ChatWindowSize): void {
  try {
    const next = clampChatWindowSize(size);
    window.localStorage.setItem(CHAT_WINDOW_SIZE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}
