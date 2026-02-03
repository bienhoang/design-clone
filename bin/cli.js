#!/usr/bin/env node
/**
 * Design Clone Skill CLI
 *
 * Usage:
 *   design-clone init [--force]  Install skill to ~/.claude/skills/
 *   design-clone verify          Check installation status
 *   design-clone clone-site <url> [options]  Clone multiple pages
 *   design-clone help            Show help
 */

import { init } from './commands/init.js';
import { verify } from './commands/verify.js';
import { help } from './commands/help.js';
import { cloneSite, parseArgs as parseCloneSiteArgs, showHelp as showCloneSiteHelp } from './commands/clone-site.js';

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
      case 'clone-site':
        if (args.includes('--help') || args.includes('-h')) {
          showCloneSiteHelp();
        } else {
          const options = parseCloneSiteArgs(args);
          if (!options.url) {
            console.error('Error: URL is required');
            showCloneSiteHelp();
            process.exit(1);
          }
          const result = await cloneSite(options.url, options);
          console.log(JSON.stringify(result, null, 2));
        }
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
