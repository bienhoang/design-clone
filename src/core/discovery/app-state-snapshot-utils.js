/**
 * Serialization and filtering utilities for app state snapshots.
 *
 * Provides safe object serialization (handles circular refs, functions, symbols),
 * sensitive key filtering (tokens, passwords, secrets), and state size enforcement.
 * Used by app-state-snapshot.js (main module).
 */

import { SIZE_LIMITS } from '../../shared/config.js';

// ============================================================================
// Constants
// ============================================================================

/** Maximum state size in bytes (1MB) - sourced from centralized config */
export const MAX_STATE_SIZE = SIZE_LIMITS.MAX_STATE;

/** Maximum depth for recursive object traversal */
export const MAX_TRAVERSAL_DEPTH = 50;

/** Patterns to identify sensitive keys */
export const SENSITIVE_PATTERNS = [
  /token/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /auth/i,
  /api[_-]?key/i,
  /credential/i,
  /private/i,
  /session/i,
  /cookie/i,
  /bearer/i,
  /jwt/i,
  /access[_-]?key/i,
  /refresh[_-]?token/i
];

/** Marker for filtered sensitive values */
export const FILTERED_MARKER = '[FILTERED]';

/** Marker for circular references */
export const CIRCULAR_MARKER = '[Circular]';

/** Marker for unserializable values */
export const UNSERIALIZABLE_MARKER = '[Unserializable]';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a key matches sensitive patterns
 * @param {string} key - Object key to check
 * @returns {boolean}
 */
export function isSensitiveKey(key) {
  if (typeof key !== 'string') return false;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Filter sensitive keys from an object recursively
 * @param {*} obj - Object to filter
 * @param {string[]} warnings - Array to collect warnings
 * @param {string} path - Current path for warning messages
 * @param {number} depth - Current recursion depth
 * @returns {*} Filtered object
 */
export function filterSensitive(obj, warnings = [], path = '', depth = 0) {
  // Prevent infinite recursion
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return '[Max Depth Exceeded]';
  }

  // Handle primitives
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item, i) =>
      filterSensitive(item, warnings, `${path}[${i}]`, depth + 1)
    );
  }

  // Handle objects
  const filtered = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;

    if (isSensitiveKey(key)) {
      warnings.push(`Filtered sensitive key: ${fullPath}`);
      filtered[key] = FILTERED_MARKER;
      continue;
    }

    filtered[key] = filterSensitive(value, warnings, fullPath, depth + 1);
  }

  return filtered;
}

/**
 * Safely serialize an object handling circular refs, functions, symbols
 * @param {*} obj - Object to serialize
 * @param {WeakSet} seen - Set of seen objects for circular detection
 * @param {number} depth - Current recursion depth
 * @returns {*} Serializable version of object
 */
export function safeSerialize(obj, seen = new WeakSet(), depth = 0) {
  if (depth > MAX_TRAVERSAL_DEPTH) return '[Max Depth Exceeded]';

  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'boolean' || typeof obj === 'number' || typeof obj === 'string') return obj;

  if (typeof obj === 'function') return '[Function]';
  if (typeof obj === 'symbol') return obj.toString();
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof RegExp) return obj.toString();
  if (obj instanceof Error) return { message: obj.message, name: obj.name };
  if (obj instanceof Map) return Object.fromEntries(obj);
  if (obj instanceof Set) return Array.from(obj);

  if (typeof obj === 'object') {
    if (seen.has(obj)) return CIRCULAR_MARKER;
    seen.add(obj);

    try {
      if (Array.isArray(obj)) {
        return obj.map(item => safeSerialize(item, seen, depth + 1));
      }

      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        try {
          result[key] = safeSerialize(value, seen, depth + 1);
        } catch {
          result[key] = UNSERIALIZABLE_MARKER;
        }
      }
      return result;
    } catch {
      return UNSERIALIZABLE_MARKER;
    }
  }

  return obj;
}

/**
 * Enforce state size limit, truncating store state if exceeded
 * @param {import('./app-state-snapshot.js').StateSnapshot} snapshot - State snapshot to check
 * @param {string[]} warnings - Array to collect warnings
 * @returns {import('./app-state-snapshot.js').StateSnapshot} Possibly truncated snapshot
 */
export function enforceStateLimit(snapshot, warnings) {
  const serialized = JSON.stringify(snapshot);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');

  if (sizeBytes > MAX_STATE_SIZE) {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    warnings.push(`State exceeded 1MB limit (${sizeMB}MB), store state truncated`);

    return {
      ...snapshot,
      storeState: {
        _truncated: true,
        _reason: `exceeded 1MB limit (${sizeMB}MB)`,
        _originalType: snapshot.storeType
      },
      sizeBytes: MAX_STATE_SIZE
    };
  }

  return { ...snapshot, sizeBytes };
}
