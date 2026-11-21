import pkg from '../package.json';

/** SemVer from package.json (source of truth for site releases). */
export const APP_VERSION = typeof pkg.version === 'string' ? pkg.version : '0.0.0';

/** Display label, e.g. `v1.0.0`. */
export const APP_VERSION_LABEL = `v${APP_VERSION.replace(/^v/i, '')}`;
