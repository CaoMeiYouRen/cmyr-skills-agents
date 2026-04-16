#!/usr/bin/env node

import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify, parseArgs } from 'node:util';

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
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
  const { values } = parseArgs({
    args: argv.slice(2),
    allowPositionals: false,
    options: {
      branch: { type: 'string' },
      pull: { type: 'string', default: 'true' },
      remote: { type: 'string', default: 'origin' },
    },
  });

  return {
    branch: values.branch || '',
    pull: parseBoolean(values.pull, true),
    remote: values.remote || 'origin',
  };
}

async function main() {
  const args = parseCommandLine(process.argv);
  const cwd = process.cwd();

  const insideRepo = await git(['rev-parse', '--is-inside-work-tree'], cwd).catch(() => 'false');
  if (insideRepo !== 'true') {
    throw new Error('Current directory is not a Git repository.');
  }

  const status = await git(['status', '--porcelain', '--untracked-files=all'], cwd);
  if (status) {
    console.error('Repository is dirty. Commit or stash changes before remediation.');
    console.error(status);
    process.exitCode = 2;
    return;
  }

  const branch = args.branch || await git(['branch', '--show-current'], cwd);
  if (!branch) {
    throw new Error('Unable to determine current branch.');
  }

  await execFileAsync('git', ['fetch', args.remote, branch], { cwd });

  const upstreamRef = `${args.remote}/${branch}`;
  const counts = await git(['rev-list', '--left-right', '--count', `HEAD...${upstreamRef}`], cwd);
  const [aheadRaw, behindRaw] = counts.split(/\s+/);
  const ahead = Number(aheadRaw || 0);
  const behind = Number(behindRaw || 0);

  if (Number.isNaN(ahead) || Number.isNaN(behind)) {
    throw new Error(`Unable to parse ahead/behind counts: ${counts}`);
  }

  if (behind > 0) {
    if (!args.pull) {
      console.error(`Branch is behind ${upstreamRef} by ${behind} commit(s).`);
      process.exitCode = 3;
      return;
    }

    try {
      await execFileAsync('git', ['pull', '--ff-only', args.remote, branch], { cwd, stdio: 'inherit' });
    } catch (error) {
      console.error(`Fast-forward pull failed for ${upstreamRef}. Manual conflict resolution is required.`);
      console.error(String(error?.message || error));
      process.exitCode = 4;
      return;
    }
  }

  console.info(JSON.stringify({
    ahead,
    behind,
    branch,
    remote: args.remote,
    status: behind > 0 ? 'updated' : 'clean',
    upstreamRef,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[check-git-preflight] ${error.message}`);
  process.exitCode = 1;
});
