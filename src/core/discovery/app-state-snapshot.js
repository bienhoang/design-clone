/**
 * App State Snapshot Module
 *
 * Captures application state from SPAs including:
 * - Framework data (__NEXT_DATA__, __NUXT__)
 * - State management stores (Redux, Vuex, Pinia, Zustand)
 *
 * Features:
 * - Sensitive data filtering (tokens, passwords, secrets)
 * - Safe serialization (handles circular refs, functions, symbols)
 * - Size limit enforcement (1MB max)
 *
 * @module app-state-snapshot
 */

import {
  MAX_STATE_SIZE,
  SENSITIVE_PATTERNS,
  FILTERED_MARKER,
  CIRCULAR_MARKER,
  isSensitiveKey,
  filterSensitive,
  safeSerialize,
  enforceStateLimit
} from './app-state-snapshot-utils.js';

import {
  captureFrameworkData,
  captureStoreState
} from './app-state-snapshot-capture.js';

// Re-export constants and utilities for backward compatibility
export {
  MAX_STATE_SIZE,
  SENSITIVE_PATTERNS,
  FILTERED_MARKER,
  CIRCULAR_MARKER,
  isSensitiveKey,
  filterSensitive,
  safeSerialize,
  enforceStateLimit,
  captureFrameworkData,
  captureStoreState
};

// ============================================================================
// Type Definitions (JSDoc)
// ============================================================================

/**
 * @typedef {Object} StateSnapshot
 * @property {Object|null} frameworkData - __NEXT_DATA__, __NUXT__, etc.
 * @property {Object|null} storeState - Redux/Vuex/Pinia/Zustand state
 * @property {string|null} framework - Detected framework name
 * @property {string} storeType - 'redux'|'vuex'|'pinia'|'zustand'|'none'
 * @property {string[]} warnings - Serialization/filtering warnings
 * @property {number} capturedAt - Unix timestamp
 * @property {number} sizeBytes - Serialized size in bytes
 */

// ============================================================================
// Main Export
// ============================================================================

/**
 * Capture application state from page
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object|null} [frameworkInfo] - Framework detection result
 * @returns {Promise<StateSnapshot>}
 */
export async function captureAppState(page, frameworkInfo = null) {
  const warnings = [];
  const framework = frameworkInfo?.framework || null;

  let snapshot = {
    frameworkData: null,
    storeState: null,
    framework,
    storeType: 'none',
    warnings,
    capturedAt: Date.now(),
    sizeBytes: 0
  };

  try {
    const rawFrameworkData = await captureFrameworkData(page, framework);
    if (rawFrameworkData) {
      const serialized = safeSerialize(rawFrameworkData);
      snapshot.frameworkData = filterSensitive(serialized, warnings);
    }

    const storeResult = await captureStoreState(page);
    if (storeResult.state) {
      const serialized = safeSerialize(storeResult.state);
      snapshot.storeState = filterSensitive(serialized, warnings);
      snapshot.storeType = storeResult.type;
    }

    snapshot = enforceStateLimit(snapshot, warnings);
  } catch (error) {
    warnings.push(`State capture error: ${error.message}`);
  }

  return snapshot;
}

/**
 * Format state snapshot for logging
 * @param {StateSnapshot} snapshot - Captured state
 * @returns {string}
 */
export function formatStateSnapshot(snapshot) {
  const lines = [
    '\n=== App State Snapshot ===',
    `Framework: ${snapshot.framework || 'unknown'}`,
    `Store Type: ${snapshot.storeType}`,
    `Framework Data: ${snapshot.frameworkData ? 'captured' : 'none'}`,
    `Store State: ${snapshot.storeState ? 'captured' : 'none'}`,
    `Size: ${(snapshot.sizeBytes / 1024).toFixed(2)} KB`
  ];

  if (snapshot.warnings.length > 0) {
    lines.push(`Warnings (${snapshot.warnings.length}):`);
    snapshot.warnings.slice(0, 5).forEach(w => lines.push(`  - ${w}`));
    if (snapshot.warnings.length > 5) {
      lines.push(`  ... and ${snapshot.warnings.length - 5} more`);
    }
  }

  return lines.join('\n');
}
