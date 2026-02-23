#!/usr/bin/env node
/**
 * Design Clone Skill CLI
 *
 * Usage:
 *   design-clone init [--force]     Install skill to ~/.claude/skills/
 *   design-clone verify             Check installation status
 *   design-clone update [--force]   Update to latest version
 *   design-clone uninstall [--yes]  Remove skill installation
 *   design-clone help               Show help
 *   design-clone --version          Show version
 */

import { init } from './commands/init.js';
import { verify } from './commands/verify.js';
import { help } from './commands/help.js';
import { uninstall } from './commands/uninstall.js';
import { update } from './commands/update.js';
import { getVersion } from './utils/version.js';
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
      case 'uninstall':
      case 'remove':
        await uninstall(args);
        break;
      case 'update':
      case 'upgrade':
        await update(args);
        break;
      case '--version':
      case '-v':
        console.log(`design-clone v${getVersion()}`);
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
