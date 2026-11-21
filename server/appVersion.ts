import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

function readPackageVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(root, '..', 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    if (typeof parsed.version === 'string' && parsed.version.trim()) {
      return parsed.version.trim().replace(/^v/i, '');
    }
  } catch {
    /* ignore */
  }
  return '0.0.0';
}

export const APP_VERSION = readPackageVersion();
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
