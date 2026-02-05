#!/usr/bin/env node
/**
 * Parse Figma URLs and extract file_key, node_id
 *
 * Usage:
 *   node parse-url.js --url "https://figma.com/design/abc123/..."
 *   node parse-url.js "https://figma.com/file/abc123/..."
 *
 * Supported URL formats:
 *   - figma.com/design/{file_key}/{name}?node-id={node_id}
 *   - figma.com/file/{file_key}/{name}
 *   - figma.com/proto/{file_key}/{name}
 *
 * Output (JSON):
 *   { success: true, fileKey: "...", nodeId: "..." | null, urlType: "design"|"file"|"proto" }
 *   { success: false, error: "..." }
 */

import { parseArgs, outputJSON, outputError } from '../utils/helpers.js';

/**
 * Figma URL patterns for different URL types
 * Each pattern captures: [1] file_key (22 chars alphanumeric), [2] node_id (optional)
 * Anchored patterns prevent matching subdomains like evil-figma.com
 */
const FIGMA_URL_PATTERNS = [
  // figma.com/design/{file_key}/{name}?node-id={node_id}
  // Node ID can be URL-encoded (%3A) or plain (colon/hyphen)
  {
    pattern: /(?:^|\/\/)(?:www\.)?figma\.com\/design\/([a-zA-Z0-9]{15,30})(?:\/[^?]*)?(?:\?.*node-id=([0-9%A-Fa-f:-]+))?/,
    type: 'design'
  },
  // figma.com/file/{file_key}/{name}?node-id={node_id}
  {
    pattern: /(?:^|\/\/)(?:www\.)?figma\.com\/file\/([a-zA-Z0-9]{15,30})(?:\/[^?]*)?(?:\?.*node-id=([0-9%A-Fa-f:-]+))?/,
    type: 'file'
  },
  // figma.com/proto/{file_key}/{name}?node-id={node_id}
  {
    pattern: /(?:^|\/\/)(?:www\.)?figma\.com\/proto\/([a-zA-Z0-9]{15,30})(?:\/[^?]*)?(?:\?.*node-id=([0-9%A-Fa-f:-]+))?/,
    type: 'proto'
  }
];

/**
 * Validate node ID format (digits:digits or digits-digits)
 * @param {string} nodeId - Node ID to validate
 * @returns {boolean} True if valid
 */
function isValidNodeId(nodeId) {
  return /^\d+[:-]\d+$/.test(nodeId);
}

/**
 * Parse Figma URL and extract file key and node ID
 * @param {string} url - Figma URL to parse
 * @returns {Object} Parsed result with fileKey, nodeId, urlType
 */
export function parseFigmaUrl(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'URL is required' };
  }

  // Normalize URL
  const normalizedUrl = url.trim();

  // Check if it's a Figma URL
  if (!normalizedUrl.includes('figma.com')) {
    return { success: false, error: 'Not a valid Figma URL' };
  }

  // Try each pattern
  for (const { pattern, type } of FIGMA_URL_PATTERNS) {
    const match = normalizedUrl.match(pattern);
    if (match) {
      const fileKey = match[1];
      // Node ID may have URL encoding, decode it
      let nodeId = match[2] || null;
      if (nodeId) {
        nodeId = decodeURIComponent(nodeId).trim();
        // Validate node ID format
        if (!isValidNodeId(nodeId)) {
          return {
            success: false,
            error: `Invalid node ID format: "${nodeId}". Expected format: "123:456" or "123-456"`
          };
        }
      }

      return {
        success: true,
        fileKey,
        nodeId,
        urlType: type
      };
    }
  }

  return { success: false, error: 'Invalid Figma URL format' };
}

/**
 * CLI entry point
 */
function main() {
  const args = parseArgs(process.argv.slice(2));

  // Get URL from --url flag or first positional argument
  let url = args.url;
  if (!url) {
    // Check for positional argument (URL without flag)
    const positional = process.argv.slice(2).find(arg =>
      !arg.startsWith('--') && arg.includes('figma.com')
    );
    url = positional;
  }

  if (!url) {
    outputError(new Error('Usage: parse-url.js --url <figma-url>'));
    return;
  }

  const result = parseFigmaUrl(url);
  outputJSON(result);
}

// Run if executed directly
if (process.argv[1]?.endsWith('parse-url.js')) {
  main();
}
