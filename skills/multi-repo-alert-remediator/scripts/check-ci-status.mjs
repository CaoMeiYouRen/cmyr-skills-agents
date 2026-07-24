#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';
import { parseArgs } from 'node:util';

function runGh(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `exit code ${code}`));
    });
  });
}

async function getLatestRun(repo) {
  try {
    const runs = JSON.parse(await runGh(['run', 'list', '-R', `CaoMeiYouRen/${repo}`, '--limit', '5', '--json', 'databaseId,conclusion,displayTitle,event,headBranch,createdAt']));
    return runs || [];
  } catch {
    return [];
  }
}

function categorize(runs) {
  const pushRuns = runs.filter(r => r.event === 'push' && r.headBranch === 'master');
  const latestPush = pushRuns[0] || null;

  const dynamicRuns = runs.filter(r => r.event === 'dynamic' && r.headBranch === 'master');
  const failedDynamic = dynamicRuns.filter(r => r.conclusion === 'failure');

  return { latestPush, failedDynamic, all: runs };
}

async function main() {
  const { positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      owner: { type: 'string', default: 'CaoMeiYouRen' },
    },
  });

  if (positionals.length === 0) {
    console.error('Usage: node check-ci-status.mjs <repo1> [repo2 ...]');
    console.error('       node check-ci-status.mjs --owner MyOrg repo1 repo2');
    process.exit(1);
  }

  const owner = 'CaoMeiYouRen';
  const results = [];

  for (const repo of positionals) {
    const runs = await getLatestRun(repo);
    const { latestPush, failedDynamic } = categorize(runs);
    results.push({
      repo,
      push: latestPush ? {
        conclusion: latestPush.conclusion || 'in_progress',
        title: latestPush.displayTitle,
        url: `https://github.com/${owner}/${repo}/actions/runs/${latestPush.databaseId}`,
      } : null,
      dependabotFailures: failedDynamic.length,
      allRuns: runs.length,
    });
  }

  console.log('\n## CI Status Report\n');
  console.log('| Repo | Push CI | Dependabot Failures | Details |');
  console.log('|------|---------|-------------------|---------|');

  for (const r of results) {
    let status = '—';
    let detail = 'no push runs';
    if (r.push) {
      const icon = r.push.conclusion === 'success' ? '✅' : r.push.conclusion === 'failure' ? '❌' : '⏳';
      status = `${icon} ${r.push.conclusion || 'running'}`;
      detail = r.push.title;
    }
    console.log(`| ${r.repo} | ${status} | ${r.dependabotFailures} failed | ${detail} |`);
  }

  console.log('\n### Failures requiring attention\n');
  for (const r of results) {
    if (r.push && r.push.conclusion === 'failure') {
      console.log(`- ❌ **${r.repo}/master**: ${r.push.title}`);
      console.log(`  ${r.push.url}`);
    }
  }

  const totalFailures = results.filter(r => r.push?.conclusion === 'failure').length;
  if (totalFailures === 0) {
    console.log('No push-triggered failures found. ✨\n');
  }
}

main().catch((error) => {
  console.error(`[check-ci-status] ${error.message}`);
  process.exitCode = 1;
});
