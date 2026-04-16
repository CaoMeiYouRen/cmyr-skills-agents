#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const SEVERITY_RANK = {
  note: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

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

function normalizeSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!(normalized in SEVERITY_RANK)) {
    throw new Error(`Unsupported severity: ${value}`);
  }
  return normalized;
}

function severityAtLeast(left, right) {
  return SEVERITY_RANK[left] >= SEVERITY_RANK[right];
}

function parseCommandLine(argv) {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    allowPositionals: true,
    options: {
      audit: { type: 'string', default: 'true' },
      'by-package': { type: 'string', default: 'false' },
      'dry-run': { type: 'string', default: 'false' },
      'frozen-check': { type: 'string', default: 'true' },
      install: { type: 'string', default: 'true' },
      'min-severity': { type: 'string', default: 'high' },
      'package-json': { type: 'string', default: 'package.json' },
      'rollback-on-failure': { type: 'string', default: 'true' },
    },
  });

  if (positionals.length === 0) {
    throw new Error('At least one override selector or package name is required.');
  }

  return {
    audit: parseBoolean(values.audit, true),
    byPackage: parseBoolean(values['by-package'], false),
    dryRun: parseBoolean(values['dry-run'], false),
    frozenCheck: parseBoolean(values['frozen-check'], true),
    install: parseBoolean(values.install, true),
    minSeverity: normalizeSeverity(values['min-severity'] || 'high'),
    packageJsonPath: values['package-json'] || 'package.json',
    rollbackOnFailure: parseBoolean(values['rollback-on-failure'], true),
    targets: positionals.map(item => String(item).trim()).filter(Boolean),
  };
}

function normalizeSelectorPackageName(selector) {
  const lastSegment = String(selector).split('>').pop()?.trim() || String(selector).trim();
  const scopedMatch = lastSegment.match(/^(@[^/]+\/[^@]+)(?:@.+)?$/);
  if (scopedMatch) {
    return scopedMatch[1];
  }

  const unscopedMatch = lastSegment.match(/^([^@]+?)(?:@.+)?$/);
  return unscopedMatch?.[1]?.trim() || lastSegment;
}

function sortObjectEntries(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function resolveOverrideMatches(overrides, targets, byPackage) {
  const entries = Object.entries(overrides || {});
  const matches = [];

  if (byPackage) {
    const targetSet = new Set(targets);
    entries.forEach(([selector, value]) => {
      const packageName = normalizeSelectorPackageName(selector);
      if (targetSet.has(packageName)) {
        matches.push({ packageName, selector, value });
      }
    });
    return matches;
  }

  const valueMap = new Map(entries);
  return targets.map((selector) => {
    if (!valueMap.has(selector)) {
      return null;
    }
    return {
      packageName: normalizeSelectorPackageName(selector),
      selector,
      value: valueMap.get(selector),
    };
  }).filter(Boolean);
}

function dependencyAlertFingerprint(alert) {
  return [
    String(alert.packageName || ''),
    String(alert.severity || ''),
    String(alert.summary || ''),
    String(alert.patchedVersion || ''),
    String(alert.manifestPath || ''),
    String(alert.source || ''),
  ].join('::');
}

function filterDependencyAlerts(payload) {
  return Array.isArray(payload?.alerts)
    ? payload.alerts.filter(alert => alert?.source === 'dependabot')
    : [];
}

function compareSnapshots({ beforePayload, afterPayload, minSeverity, trackedPackages }) {
  const beforeAlerts = filterDependencyAlerts(beforePayload);
  const afterAlerts = filterDependencyAlerts(afterPayload);
  const beforeSet = new Set(beforeAlerts.map(dependencyAlertFingerprint));
  const newAlerts = afterAlerts.filter(alert => !beforeSet.has(dependencyAlertFingerprint(alert)));

  const newSevereAlerts = newAlerts.filter(alert => severityAtLeast(alert.severity, minSeverity));
  const reintroducedTargetAlerts = newAlerts.filter(alert => trackedPackages.has(alert.packageName));

  return {
    newAlerts,
    newSevereAlerts,
    reintroducedTargetAlerts,
  };
}

function formatAlert(alert) {
  return `${alert.packageName} [${alert.severity}] ${alert.summary}`;
}

async function readJson(filePath) {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

function runNode(commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, commandArgs, {
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

async function collectAlertSnapshot(outputJsonPath) {
  const scriptPath = fileURLToPath(new URL('./collect-security-alerts.mjs', import.meta.url));
  const exitCode = await runNode([scriptPath, '--output-json', outputJsonPath]);
  if (exitCode !== 0) {
    throw new Error(`collect-security-alerts.mjs failed with exit code ${exitCode}.`);
  }

  return readJson(outputJsonPath);
}

async function restoreFiles(backups) {
  await Promise.all(backups.map(async ({ content, filePath, missing }) => {
    if (missing) {
      await rm(filePath, { force: true });
      return;
    }
    await writeFile(filePath, content, 'utf8');
  }));
}

async function captureBackups(filePaths) {
  return Promise.all(filePaths.map(async (filePath) => {
    const exists = await fileExists(filePath);
    return {
      content: exists ? await readFile(filePath, 'utf8') : '',
      filePath,
      missing: !exists,
    };
  }));
}

async function main() {
  const args = parseCommandLine(process.argv);
  const packageJsonPath = path.resolve(args.packageJsonPath);
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);
  const overrides = packageJson?.pnpm?.overrides;

  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error('package.json does not contain a pnpm.overrides object.');
  }

  const matches = resolveOverrideMatches(overrides, args.targets, args.byPackage);
  if (matches.length === 0) {
    throw new Error(args.byPackage
      ? `No override selectors matched package name(s): ${args.targets.join(', ')}`
      : `No override selectors matched exactly: ${args.targets.join(', ')}`);
  }

  const unmatchedTargets = args.targets.filter((target) => {
    if (args.byPackage) {
      return !matches.some(match => match.packageName === target);
    }
    return !matches.some(match => match.selector === target);
  });
  if (unmatchedTargets.length > 0) {
    throw new Error(`Some requested targets did not match overrides: ${unmatchedTargets.join(', ')}`);
  }

  const trackedPackages = new Set(matches.map(match => match.packageName));
  console.info(`Matched ${matches.length} override selector(s): ${matches.map(match => match.selector).join(', ')}`);

  if (args.dryRun) {
    console.info('Dry run only. No files were modified.');
    return;
  }

  const lockfilePath = path.resolve(path.dirname(packageJsonPath), 'pnpm-lock.yaml');
  const backups = await captureBackups([packageJsonPath, lockfilePath]);
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'remove-pnpm-override-'));
  let packageJsonWritten = false;
  let installCompleted = false;

  try {
    let beforePayload = null;
    if (args.audit) {
      beforePayload = await collectAlertSnapshot(path.join(tempDirectory, 'before.json'));
    }

    const nextOverrides = { ...overrides };
    matches.forEach(({ selector }) => {
      delete nextOverrides[selector];
    });

    if (Object.keys(nextOverrides).length === 0) {
      delete packageJson.pnpm.overrides;
      if (Object.keys(packageJson.pnpm).length === 0) {
        delete packageJson.pnpm;
      }
    } else {
      packageJson.pnpm.overrides = sortObjectEntries(nextOverrides);
    }

    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    packageJsonWritten = true;

    if (args.install) {
      const installCode = await runPnpm(['install', '--no-frozen-lockfile']);
      if (installCode !== 0) {
        throw new Error(`pnpm install --no-frozen-lockfile failed with exit code ${installCode}.`);
      }
      installCompleted = true;
    }

    if (args.frozenCheck) {
      const frozenCode = await runPnpm(['install', '--frozen-lockfile']);
      if (frozenCode !== 0) {
        throw new Error(`pnpm install --frozen-lockfile failed with exit code ${frozenCode}.`);
      }
    }

    if (args.audit) {
      const afterPayload = await collectAlertSnapshot(path.join(tempDirectory, 'after.json'));
      const comparison = compareSnapshots({
        afterPayload,
        beforePayload,
        minSeverity: args.minSeverity,
        trackedPackages,
      });

      if (comparison.reintroducedTargetAlerts.length > 0 || comparison.newSevereAlerts.length > 0) {
        const reasons = [];

        if (comparison.reintroducedTargetAlerts.length > 0) {
          reasons.push(`reintroduced target-package dependency alerts: ${comparison.reintroducedTargetAlerts.map(formatAlert).join(' | ')}`);
        }
        if (comparison.newSevereAlerts.length > 0) {
          reasons.push(`new dependency alerts at or above ${args.minSeverity}: ${comparison.newSevereAlerts.map(formatAlert).join(' | ')}`);
        }

        throw new Error(`Override removal did not pass security regression checks; ${reasons.join('; ')}.`);
      }
    }

    console.info(JSON.stringify({
      auditChecked: args.audit,
      frozenCheck: args.frozenCheck,
      install: args.install,
      minSeverity: args.minSeverity,
      removedSelectors: matches.map(match => match.selector),
      trackedPackages: [...trackedPackages].sort(),
    }, null, 2));
  } catch (error) {
    if (args.rollbackOnFailure && packageJsonWritten) {
      console.error('Validation failed. Restoring package.json and pnpm-lock.yaml from local backups.');
      await restoreFiles(backups);

      if (installCompleted) {
        const restoreInstallCode = await runPnpm(['install', '--no-frozen-lockfile']);
        if (restoreInstallCode !== 0) {
          console.error(`Rollback install failed with exit code ${restoreInstallCode}.`);
        } else if (args.frozenCheck) {
          const restoreFrozenCode = await runPnpm(['install', '--frozen-lockfile']);
          if (restoreFrozenCode !== 0) {
            console.error(`Rollback frozen verification failed with exit code ${restoreFrozenCode}.`);
          }
        }
      }
    }

    throw error;
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(`[remove-pnpm-override] ${error.message}`);
  process.exitCode = 1;
});
