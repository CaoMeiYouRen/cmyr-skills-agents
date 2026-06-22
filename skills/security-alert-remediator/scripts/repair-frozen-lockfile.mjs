#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function runPnpm(args, { captureStderr = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn(process.env.comspec || 'cmd.exe', ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'inherit', captureStderr ? 'pipe' : 'inherit'],
        })
      : spawn('pnpm', args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'inherit', captureStderr ? 'pipe' : 'inherit'],
        });

    let stderr = '';
    if (captureStderr && child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr });
    });
  });
}

/**
 * Parse ERR_PNPM_IGNORED_BUILDS error message to extract package names.
 * Example: "Ignored build scripts: esbuild@0.25.0, sharp@0.33.5, workerd@1.20250718.0"
 * Returns: ["esbuild", "sharp", "workerd"]
 */
function parseIgnoredBuildsFromStderr(stderr) {
  const match = stderr.match(/\[?ERR_PNPM_IGNORED_BUILDS\]?\s*Ignored build scripts:\s*(.+)/);
  if (!match) return [];

  return match[1]
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim();
      // Strip leading " - " or "* " or similar list markers
      const cleaned = trimmed.replace(/^[-\*\s]+/, '');
      // Extract package name before @version
      const atIndex = cleaned.lastIndexOf('@');
      return atIndex > 0 ? cleaned.substring(0, atIndex) : cleaned;
    })
    .filter(Boolean);
}

/**
 * Add packages to allowBuilds in pnpm-workspace.yaml.
 * Returns true if the file was modified.
 */
async function addAllowBuilds(packageNames) {
  if (packageNames.length === 0) return false;

  const workspacePath = path.resolve(process.cwd(), 'pnpm-workspace.yaml');
  if (!existsSync(workspacePath)) return false;

  const content = await readFile(workspacePath, 'utf8');
  const lines = content.split('\n');

  // Check if allowBuilds section already exists
  const allowBuildsIndex = lines.findIndex((line) => /^\s*allowBuilds\s*:/.test(line));
  let modified = false;

  if (allowBuildsIndex === -1) {
    // Add new allowBuilds section at the end of the file
    const newSection = [
      '',
      'allowBuilds:',
      ...packageNames.map((name) => `  - ${name}`),
    ];
    lines.push(...newSection);
    modified = true;
  } else {
    // Find existing entries to avoid duplicates
    const existingEntries = new Set();
    for (let i = allowBuildsIndex + 1; i < lines.length; i++) {
      const match = lines[i].match(/^\s*-\s+(.+)/);
      if (match) {
        existingEntries.add(match[1].trim());
      } else if (lines[i].trim() !== '') {
        break; // End of allowBuilds list
      }
    }

    const newEntries = packageNames.filter((name) => !existingEntries.has(name));
    if (newEntries.length > 0) {
      // Insert new entries after existing ones
      let insertIndex = allowBuildsIndex + 1;
      while (insertIndex < lines.length && /^\s*-\s+/.test(lines[insertIndex])) {
        insertIndex++;
      }
      const newLines = newEntries.map((name) => `  - ${name}`);
      lines.splice(insertIndex, 0, ...newLines);
      modified = true;
    }
  }

  if (modified) {
    await writeFile(workspacePath, `${lines.join('\n')}\n`, 'utf8');
    console.info(`[repair-frozen-lockfile] Added to allowBuilds: ${packageNames.join(', ')}`);
  }

  return modified;
}

async function main() {
  // Step 1: Try frozen lockfile install first
  const frozenResult = await runPnpm(['install', '--frozen-lockfile'], { captureStderr: true });

  if (frozenResult.code === 0) {
    console.info('[repair-frozen-lockfile] pnpm install --frozen-lockfile already passes.');
    return;
  }

  // Step 2: Check for ERR_PNPM_IGNORED_BUILDS
  const ignoredBuilds = parseIgnoredBuildsFromStderr(frozenResult.stderr);
  if (ignoredBuilds.length > 0) {
    console.info(`[repair-frozen-lockfile] Detected ERR_PNPM_IGNORED_BUILDS: ${ignoredBuilds.join(', ')}`);
    const modified = await addAllowBuilds(ignoredBuilds);
    if (modified) {
      console.info('[repair-frozen-lockfile] Retrying install after adding allowBuilds...');
      const retryResult = await runPnpm(['install', '--no-frozen-lockfile'], { captureStderr: true });
      if (retryResult.code !== 0) {
        process.exitCode = retryResult.code;
        return;
      }
      // Verify with frozen lockfile
      const verifyResult = await runPnpm(['install', '--frozen-lockfile']);
      process.exitCode = verifyResult.code;
      return;
    }
  }

  // Step 3: Try non-frozen install to sync lockfile
  console.info('[repair-frozen-lockfile] Frozen lockfile check failed. Rebuilding lockfile with non-frozen install.');
  const installResult = await runPnpm(['install', '--no-frozen-lockfile'], { captureStderr: true });

  if (installResult.code === 0) {
    // Non-frozen install succeeded, now verify with frozen
    const verifyResult = await runPnpm(['install', '--frozen-lockfile']);
    process.exitCode = verifyResult.code;
    return;
  }

  // Step 4: Check for ERR_PNPM_IGNORED_BUILDS in non-frozen install
  const ignoredBuilds2 = parseIgnoredBuildsFromStderr(installResult.stderr);
  if (ignoredBuilds2.length > 0) {
    console.info(`[repair-frozen-lockfile] Detected ERR_PNPM_IGNORED_BUILDS during non-frozen install: ${ignoredBuilds2.join(', ')}`);
    const modified = await addAllowBuilds(ignoredBuilds2);
    if (modified) {
      console.info('[repair-frozen-lockfile] Retrying install after adding allowBuilds...');
      const retryResult = await runPnpm(['install', '--no-frozen-lockfile'], { captureStderr: true });
      if (retryResult.code !== 0) {
        process.exitCode = retryResult.code;
        return;
      }
      const verifyResult = await runPnpm(['install', '--frozen-lockfile']);
      process.exitCode = verifyResult.code;
      return;
    }
  }

  // Step 5: Non-frozen install also failed for other reasons — try lockfile regeneration
  console.info('[repair-frozen-lockfile] Non-frozen install also failed. Attempting lockfile regeneration...');

  const lockfilePath = path.resolve(process.cwd(), 'pnpm-lock.yaml');
  const backupPath = `${lockfilePath}.bak-${Date.now()}`;

  if (existsSync(lockfilePath)) {
    await writeFile(backupPath, await readFile(lockfilePath));
    await unlink(lockfilePath);
    console.info(`[repair-frozen-lockfile] Removed corrupted lockfile (backup: ${path.basename(backupPath)}).`);
  }

  const regenerateResult = await runPnpm(['install', '--no-frozen-lockfile'], { captureStderr: true });

  if (regenerateResult.code === 0) {
    console.info('[repair-frozen-lockfile] Lockfile regenerated successfully.');
    const verifyResult = await runPnpm(['install', '--frozen-lockfile']);
    process.exitCode = verifyResult.code;
    return;
  }

  // Step 6: Final attempt — check if regenerated install also had ignored builds
  const ignoredBuilds3 = parseIgnoredBuildsFromStderr(regenerateResult.stderr);
  if (ignoredBuilds3.length > 0) {
    console.info(`[repair-frozen-lockfile] Detected ERR_PNPM_IGNORED_BUILDS during regeneration: ${ignoredBuilds3.join(', ')}`);
    const modified = await addAllowBuilds(ignoredBuilds3);
    if (modified) {
      console.info('[repair-frozen-lockfile] Retrying install after adding allowBuilds...');
      const retryResult = await runPnpm(['install', '--no-frozen-lockfile'], { captureStderr: true });
      if (retryResult.code !== 0) {
        process.exitCode = retryResult.code;
        return;
      }
      const verifyResult = await runPnpm(['install', '--frozen-lockfile']);
      process.exitCode = verifyResult.code;
      return;
    }
  }

  // All recovery attempts failed
  console.error(`[repair-frozen-lockfile] All recovery attempts failed. Lockfile backup saved as ${backupPath}`);
  process.exitCode = regenerateResult.code;
}

main().catch((error) => {
  console.error(`[repair-frozen-lockfile] ${error.message}`);
  process.exitCode = 1;
});
