#!/usr/bin/env node
/**
 * Design Clone Skill CLI
 *
 * Usage:
 *   design-clone init [--force]  Install skill to ~/.claude/skills/
 *   design-clone verify          Check installation status
 *   design-clone help            Show help
 */

import { init } from './commands/init.js';
import { verify } from './commands/verify.js';
import { help } from './commands/help.js';

const [,, command, ...args] = process.argv;

async function main() {
  try {
    switch (command) {
      case 'init':
      case 'install':
        await init(args);
        break;
      case 'verify':
      case 'check':
        await verify();
        break;
      case 'help':
      case '--help':
      case '-h':
      case undefined:
        help();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "design-clone help" for usage');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
