/**
 * Browser Context Pool
 *
 * Manages a pool of Playwright browser contexts for parallel page capture.
 * Includes memory guard to prevent OOM and queue for overflow requests.
 */

import os from 'os';

const DEFAULT_MAX_CONTEXTS = 3;
const MIN_FREE_MEMORY_MB = 500;

export class BrowserContextPool {
  #browser;
  #maxContexts;
  #active = new Set();
  #waitQueue = [];

  /**
   * @param {import('playwright').Browser} browser
   * @param {{ maxContexts?: number }} options
   */
  constructor(browser, options = {}) {
    this.#browser = browser;
    this.#maxContexts = options.maxContexts || DEFAULT_MAX_CONTEXTS;
  }

  /**
   * Acquire a browser context + page from the pool.
   * Waits if pool is full or memory is low.
   * @returns {Promise<{context: import('playwright').BrowserContext, page: import('playwright').Page}>}
   */
  async acquire() {
    // Memory guard: wait for a release if free memory is low
    const freeMB = os.freemem() / (1024 * 1024);
    if (freeMB < MIN_FREE_MEMORY_MB && this.#active.size > 0) {
      return this.#waitForRelease();
    }

    if (this.#active.size >= this.#maxContexts) {
      return this.#waitForRelease();
    }

    const context = await this.#browser.newContext();
    const page = await context.newPage();
    this.#active.add(context);
    return { context, page };
  }

  /**
   * Release a context back to the pool (closes it).
   * @param {import('playwright').BrowserContext} context
   */
  async release(context) {
    await context.close().catch(() => {});
    this.#active.delete(context);
    if (this.#waitQueue.length > 0) {
      const resolve = this.#waitQueue.shift();
      resolve(this.acquire());
    }
  }

  /** @returns {Promise<{context, page}>} */
  #waitForRelease() {
    return new Promise(resolve => { this.#waitQueue.push(resolve); });
  }

  /** Close all active contexts */
  async drain() {
    const contexts = [...this.#active];
    await Promise.all(contexts.map(c => c.close().catch(() => {})));
    this.#active.clear();
    this.#waitQueue = [];
  }

  get activeCount() { return this.#active.size; }
}
