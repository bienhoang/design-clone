/**
 * Centralized TTY-aware logging for CLI output.
 * Logs to stderr only when attached to a terminal.
 * Keeps stdout clean for JSON output.
 */

const isTTY = process.stderr.isTTY;

export function logInfo(msg) { if (isTTY) console.error(`[INFO] ${msg}`); }
export function logWarn(msg) { if (isTTY) console.error(`[WARN] ${msg}`); }
export function logError(msg) { if (isTTY) console.error(`[ERROR] ${msg}`); }
export { isTTY };
