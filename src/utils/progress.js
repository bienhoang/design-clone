/**
 * TTY-aware progress reporting for extraction/capture pipelines.
 * Writes to stderr only when attached to a terminal.
 * Keeps stdout clean for JSON output.
 */

import { isTTY } from './log.js';

export class ProgressReporter {
  #current = 0;
  #total = 0;
  #label = '';

  start(totalSteps, label = '') {
    this.#total = totalSteps;
    this.#current = 0;
    this.#label = label;
    if (isTTY) process.stderr.write(`[0/${totalSteps}] ${label}\n`);
  }

  step(label, details = '') {
    this.#current++;
    const detailStr = details ? ` (${details})` : '';
    if (isTTY) process.stderr.write(`[${this.#current}/${this.#total}] ${label}${detailStr}\n`);
  }

  complete(summary = '') {
    if (isTTY) process.stderr.write(`[done] ${summary}\n`);
  }
}

export function createProgress() { return new ProgressReporter(); }
