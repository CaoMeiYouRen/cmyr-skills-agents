#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';
import { parseArgs } from 'node:util';

function runPnpm(args) {
  return new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn(process.env.comspec || 'cmd.exe', ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
        })
      : spawn('pnpm', args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
        });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

function parseBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Unsupported boolean value: ${value}`);
}

function parseCommandLine(argv) {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    allowPositionals: true,
    options: {
      'frozen-check': { type: 'string', default: 'true' },
      install: { type: 'string', default: 'true' },
      latest: { type: 'boolean', default: false },
      recursive: { type: 'boolean', default: false },
      'save-exact': { type: 'boolean', default: false },
    },
  });

  if (positionals.length === 0) {
    throw new Error('At least one package spec is required.');
  }

  return {
    frozenCheck: parseBoolean(values['frozen-check'], true),
    install: parseBoolean(values.install, true),
    latest: Boolean(values.latest),
    packages: positionals,
    recursive: Boolean(values.recursive),
    saveExact: Boolean(values['save-exact']),
  };
}

async function main() {
  const args = parseCommandLine(process.argv);
  const updateArgs = ['up', ...args.packages];

  if (args.latest) {
    updateArgs.push('--latest');
  }
  if (args.recursive) {
    updateArgs.push('-r');
  }
  if (args.saveExact) {
    updateArgs.push('--save-exact');
  }

  const updateCode = await runPnpm(updateArgs);
  if (updateCode !== 0) {
    process.exitCode = updateCode;
    return;
  }

  if (args.install) {
    const installCode = await runPnpm(['install', '--no-frozen-lockfile']);
    if (installCode !== 0) {
      process.exitCode = installCode;
      return;
    }
  }

  if (args.frozenCheck) {
    const verifyCode = await runPnpm(['install', '--frozen-lockfile']);
    process.exitCode = verifyCode;
  }
}

main().catch((error) => {
  console.error(`[update-pnpm-dependency] ${error.message}`);
  process.exitCode = 1;
});
