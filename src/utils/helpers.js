/**
 * Shared utility functions for design-clone scripts
 * Provides CLI parsing and JSON output helpers
 */

/**
 * Parse command line arguments into key-value object
 * @param {string[]} argv - Command line arguments
 * @returns {Object} Parsed arguments
 * @throws {TypeError} If argv is not an array
 *
 * @example
 * parseArgs(['--url', 'https://example.com', '--headless', '--port', '9222'])
 * // Returns: { url: 'https://example.com', headless: true, port: '9222' }
 */
export function parseArgs(argv) {
  // Input validation
  if (!Array.isArray(argv)) {
    throw new TypeError('argv must be an array');
  }

  const args = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Skip non-string arguments
    if (typeof arg !== 'string') continue;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];

      // If next arg exists and doesn't start with --, use it as value
      if (nextArg && typeof nextArg === 'string' && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++; // Skip next arg
      } else {
        // Boolean flag
        args[key] = true;
      }
    }
  }

  return args;
}

/**
 * Output data as formatted JSON to stdout
 * @param {Object} data - Data to output
 */
export function outputJSON(data) {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Output error as JSON to stderr and exit
 * @param {Error} error - Error object
 * @throws {never} Always exits the process
 */
export function outputError(error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(JSON.stringify({
    success: false,
    error: errorMessage,
    stack: process.env.DEBUG ? errorStack : undefined
  }, null, 2));
  process.exit(1);
}
