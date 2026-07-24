#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: opts.silent ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
  });
  return { code: result.status, stdout: result.stdout?.toString().trim() || '', stderr: result.stderr?.toString().trim() || '' };
}

function isInRebase() {
  const d = run('git', ['rev-parse', '--git-dir'], { silent: true });
  if (d.code !== 0) return false;
  return existsSync(`${d.stdout}/rebase-merge`) || existsSync(`${d.stdout}/rebase-apply`);
}

function hasConflict(file) {
  const r = run('git', ['diff', '--name-only', '--diff-filter=U'], { silent: true });
  return r.stdout.split('\n').map(s => s.trim()).includes(file);
}

async function main() {
  if (!isInRebase()) {
    console.log('[resolve-pnpm-rebase-conflict] No rebase in progress. Nothing to do.');
    return;
  }

  console.log('[resolve-pnpm-rebase-conflict] Rebase in progress detected.');

  if (hasConflict('pnpm-lock.yaml')) {
    console.log('[resolve-pnpm-rebase-conflict] pnpm-lock.yaml has conflict. Accepting theirs (remote version)...');
    run('git', ['checkout', '--theirs', 'pnpm-lock.yaml']);
    run('git', ['add', 'pnpm-lock.yaml']);
    console.log('[resolve-pnpm-rebase-conflict] pnpm-lock.yaml conflict resolved.');
  } else {
    console.log('[resolve-pnpm-rebase-conflict] No pnpm-lock.yaml conflict found.');
  }

  const otherConflicts = run('git', ['diff', '--name-only', '--diff-filter=U'], { silent: true }).stdout
    .split('\n').map(s => s.trim()).filter(Boolean)
    .filter(f => f !== 'pnpm-lock.yaml');

  if (otherConflicts.length > 0) {
    console.log(`[resolve-pnpm-rebase-conflict] Warning: other files still have conflicts: ${otherConflicts.join(', ')}`);
    console.log('[resolve-pnpm-rebase-conflict] Please resolve them manually, then run: git rebase --continue');
    process.exitCode = 1;
    return;
  }

  console.log('[resolve-pnpm-rebase-conflict] All conflicts resolved. Continuing rebase...');
  const result = run('git', ['-c', 'core.editor=true', 'rebase', '--continue']);

  if (result.code === 0) {
    console.log('[resolve-pnpm-rebase-conflict] Rebase completed successfully.');
    console.log('[resolve-pnpm-rebase-conflict] Note: you should now run "pnpm install --no-frozen-lockfile" to ensure the lockfile is consistent.');
  } else {
    console.error('[resolve-pnpm-rebase-conflict] Rebase continue failed. Please resolve manually.');
    process.exitCode = result.code;
  }
}

main().catch((error) => {
  console.error(`[resolve-pnpm-rebase-conflict] ${error.message}`);
  process.exitCode = 1;
});
