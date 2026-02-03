/**
 * Design Tokens Extraction Wrapper
 *
 * Wraps the Python script for extracting design tokens from screenshots.
 *
 * Usage:
 *   import { extractDesignTokens } from './design-tokens.js';
 *   const result = await extractDesignTokens(outputDir, cssPath);
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract design tokens from screenshots using Gemini Vision API
 *
 * @param {string} outputDir - Output directory (contains analysis/desktop/*.png)
 * @param {string} cssPath - Path to merged CSS file for reference
 * @returns {Promise<Object>} Result with { success, tokens_json, tokens_css }
 */
export async function extractDesignTokens(outputDir, cssPath = null) {
  const scriptPath = path.resolve(__dirname, '../ai/extract-design-tokens.py');
  const screenshotsDir = path.join(outputDir, 'analysis', 'desktop');

  // Build args
  const args = [
    scriptPath,
    '--screenshots', screenshotsDir,
    '--output', outputDir
  ];

  if (cssPath) {
    args.push('--css', cssPath);
  }

  return new Promise((resolve) => {
    const proc = spawn('python3', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Try to parse error from stdout (script outputs JSON errors)
        try {
          const errorResult = JSON.parse(stdout);
          resolve({
            success: false,
            error: errorResult.error || 'Unknown error',
            hint: errorResult.hint || null
          });
        } catch {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`
          });
        }
        return;
      }

      // Parse success result
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        resolve({
          success: false,
          error: `Failed to parse output: ${err.message}`
        });
      }
    });

    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        resolve({
          success: false,
          error: 'Python3 not found',
          hint: 'Install Python 3 to enable AI token extraction'
        });
      } else {
        resolve({
          success: false,
          error: err.message
        });
      }
    });
  });
}
