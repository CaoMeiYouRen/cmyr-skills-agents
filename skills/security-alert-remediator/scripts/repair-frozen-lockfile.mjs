#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';

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

async function main() {
  const frozenCode = await runPnpm(['install', '--frozen-lockfile']);
  if (frozenCode === 0) {
    console.info('pnpm install --frozen-lockfile already passes.');
    return;
  }

  console.info('Frozen lockfile check failed. Rebuilding lockfile with non-frozen install.');
  const installCode = await runPnpm(['install', '--no-frozen-lockfile']);
  if (installCode !== 0) {
    process.exitCode = installCode;
    return;
  }

  console.info('Re-running frozen lockfile verification.');
  const verifyCode = await runPnpm(['install', '--frozen-lockfile']);
  process.exitCode = verifyCode;
}

main().catch((error) => {
  console.error(`[repair-frozen-lockfile] ${error.message}`);
  process.exitCode = 1;
});
