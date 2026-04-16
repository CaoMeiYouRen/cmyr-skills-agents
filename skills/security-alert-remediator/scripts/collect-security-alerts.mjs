#!/usr/bin/env node

import { execFile, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs, promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SEVERITY_RANK = {
  info: 0,
  note: 0,
  low: 1,
  warning: 1,
  moderate: 2,
  medium: 2,
  high: 3,
  error: 3,
  critical: 4,
};

const CODE_SCANNING_RULE_SEVERITY_MAP = {
  note: 'low',
  warning: 'medium',
  error: 'high',
};

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

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePatchedVersionValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || ['<0.0.0', 'manual review required', 'none', 'unavailable'].includes(normalized)) {
    return null;
  }
  return String(value).trim();
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
      'focus-threshold': { type: 'string', default: '5' },
      'include-medium-when-clear': { type: 'string', default: 'true' },
      'min-severity': { type: 'string' },
      owner: { type: 'string' },
      'output-json': { type: 'string' },
      'output-markdown': { type: 'string' },
      registry: { type: 'string', default: 'https://registry.npmjs.org/' },
      repo: { type: 'string' },
      token: { type: 'string' },
    },
  });

  const threshold = Number(values['focus-threshold']);
  if (!Number.isInteger(threshold) || threshold <= 0) {
    throw new Error(`Unsupported focus threshold: ${values['focus-threshold']}`);
  }

  return {
    focusThreshold: threshold,
    includeMediumWhenClear: parseBoolean(values['include-medium-when-clear'], true),
    minSeverity: values['min-severity'] ? normalizeSeverity(values['min-severity']) : '',
    outputJson: values['output-json'] || '',
    outputMarkdown: values['output-markdown'] || '',
    owner: values.owner || '',
    registry: values.registry || 'https://registry.npmjs.org/',
    repo: values.repo || '',
    token: values.token || '',
  };
}

function resolveGitHubToken(explicitToken) {
  return [
    explicitToken,
    process.env.GITHUB_TOKEN,
    process.env.GH_TOKEN,
    process.env.SECURITY_ALERTS_TOKEN,
  ].find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

async function resolveRepository(args, cwd) {
  if (args.owner && args.repo) {
    return { owner: args.owner, repo: args.repo };
  }

  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    if (owner && repo) {
      return { owner, repo };
    }
  }

  const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd });
  const remoteUrl = stdout.trim();
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!match) {
    throw new Error('Unable to resolve owner/repo from Git remote.');
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

function normalizeDependabotAlert(alert) {
  const advisory = alert?.security_advisory || {};
  const vulnerability = alert?.security_vulnerability || {};
  const firstPatchedVersion = vulnerability?.first_patched_version?.identifier
    || toArray(advisory.vulnerabilities)
      .map((item) => item?.first_patched_version?.identifier)
      .find(Boolean)
    || null;

  return {
    alertNumber: String(alert?.number ?? 'unknown'),
    htmlUrl: alert?.html_url || null,
    manifestPath: alert?.dependency?.manifest_path || null,
    packageName: alert?.dependency?.package?.name || vulnerability?.package?.name || 'unknown-package',
    patchAvailable: Boolean(firstPatchedVersion),
    patchedVersion: normalizePatchedVersionValue(firstPatchedVersion),
    severity: normalizeSeverity(advisory?.severity || vulnerability?.severity || 'medium'),
    source: 'dependabot',
    state: String(alert?.state || 'open').trim().toLowerCase(),
    summary: advisory?.summary || advisory?.description || `${vulnerability?.package?.name || 'dependency'} security alert`,
  };
}

function normalizeCodeScanningAlert(alert) {
  const rawSeverity = alert?.rule?.security_severity_level
    || CODE_SCANNING_RULE_SEVERITY_MAP[String(alert?.rule?.severity || '').trim().toLowerCase()]
    || 'medium';

  return {
    alertNumber: String(alert?.number ?? 'unknown'),
    htmlUrl: alert?.html_url || null,
    locationPath: alert?.most_recent_instance?.location?.path || null,
    patchAvailable: false,
    patchedVersion: null,
    ruleId: alert?.rule?.id || 'unknown-rule',
    severity: normalizeSeverity(rawSeverity),
    source: 'code-scanning',
    state: String(alert?.state || 'open').trim().toLowerCase(),
    summary: alert?.rule?.description || alert?.most_recent_instance?.message?.text || alert?.rule?.name || 'Code scanning alert',
    toolName: alert?.tool?.name || 'unknown-tool',
  };
}

function resolveAdvisoryId(candidate) {
  if (candidate.github_advisory_id) {
    return candidate.github_advisory_id;
  }
  if (Array.isArray(candidate.cves) && candidate.cves[0]) {
    return candidate.cves[0];
  }
  if (candidate.url) {
    return candidate.url;
  }
  if (candidate.id) {
    return String(candidate.id);
  }
  return 'unknown-advisory';
}

function resolvePatchedVersions(candidate, fixAvailable) {
  if (typeof candidate.patched_versions === 'string' && candidate.patched_versions.trim()) {
    return candidate.patched_versions.trim();
  }
  if (typeof fixAvailable === 'string' && fixAvailable.trim()) {
    return fixAvailable.trim();
  }
  if (fixAvailable && typeof fixAvailable === 'object' && typeof fixAvailable.name === 'string' && typeof fixAvailable.version === 'string') {
    return `${fixAvailable.name}@${fixAvailable.version}`;
  }
  return 'unavailable';
}

function resolveRecommendation(candidate, recommendedVersion) {
  if (typeof candidate.recommendation === 'string' && candidate.recommendation.trim()) {
    return candidate.recommendation.trim();
  }
  if (typeof recommendedVersion === 'string' && recommendedVersion.trim()) {
    return `Upgrade to ${recommendedVersion.trim()}`;
  }
  return 'No direct upgrade recommendation from audit source';
}

function buildLegacyActionMap(actions) {
  const actionMap = new Map();

  toArray(actions).forEach((action) => {
    const recommendation = action.action === 'update' && action.target
      ? `Upgrade ${action.module} to ${action.target}`
      : 'Manual review required';

    toArray(action.resolves).forEach((resolve) => {
      if (resolve?.id === undefined || resolve?.id === null) {
        return;
      }
      actionMap.set(String(resolve.id), {
        patchedVersions: action.target || 'unavailable',
        recommendation,
      });
    });
  });

  return actionMap;
}

function createRiskRecord({ advisoryId, packageName, severity, source, title, paths, patchedVersions, recommendation }) {
  return {
    advisoryId,
    packageName,
    severity,
    source,
    title,
    paths: [...new Set(toArray(paths).filter(Boolean).map((item) => String(item)))].sort(),
    patchedVersions,
    recommendation,
  };
}

function parseLegacyAuditReport(report) {
  const actionMap = buildLegacyActionMap(report?.actions);

  return Object.values(report?.advisories || {}).map((advisory) => {
    const action = actionMap.get(String(advisory.id));
    return createRiskRecord({
      advisoryId: resolveAdvisoryId(advisory),
      packageName: advisory.module_name || 'unknown-package',
      severity: normalizeSeverity(advisory.severity),
      source: advisory.url || 'https://registry.npmjs.org/',
      title: advisory.title || advisory.overview || 'Untitled advisory',
      paths: toArray(advisory.findings).flatMap((finding) => toArray(finding.paths)),
      patchedVersions: resolvePatchedVersions(advisory, action?.patchedVersions),
      recommendation: resolveRecommendation(advisory, action?.patchedVersions),
    });
  });
}

function parseModernAuditReport(report) {
  const risks = [];

  for (const vulnerability of Object.values(report?.vulnerabilities || {})) {
    const packageName = vulnerability?.name || 'unknown-package';
    const viaItems = toArray(vulnerability.via).filter((item) => item && typeof item === 'object');

    if (viaItems.length === 0 && vulnerability?.severity) {
      risks.push(createRiskRecord({
        advisoryId: resolveAdvisoryId(vulnerability),
        packageName,
        severity: normalizeSeverity(vulnerability.severity),
        source: vulnerability.url || 'https://registry.npmjs.org/',
        title: vulnerability.title || `${packageName} vulnerability`,
        paths: toArray(vulnerability.nodes),
        patchedVersions: resolvePatchedVersions(vulnerability, vulnerability.fixAvailable),
        recommendation: resolveRecommendation(vulnerability, null),
      }));
      continue;
    }

    viaItems.forEach((advisory) => {
      risks.push(createRiskRecord({
        advisoryId: resolveAdvisoryId(advisory),
        packageName: advisory.name || packageName,
        severity: normalizeSeverity(advisory.severity || vulnerability.severity),
        source: advisory.url || 'https://registry.npmjs.org/',
        title: advisory.title || `${packageName} vulnerability`,
        paths: toArray(vulnerability.nodes),
        patchedVersions: resolvePatchedVersions(advisory, vulnerability.fixAvailable),
        recommendation: resolveRecommendation(advisory, null),
      }));
    });
  }

  return risks;
}

function parseAuditReport(report) {
  const risks = [...parseLegacyAuditReport(report), ...parseModernAuditReport(report)];
  const deduped = new Map();

  risks.forEach((risk) => {
    const key = `${risk.packageName}:${risk.advisoryId}:${risk.severity}`;
    const current = deduped.get(key);
    if (!current) {
      deduped.set(key, risk);
      return;
    }

    deduped.set(key, {
      ...current,
      paths: [...new Set([...current.paths, ...risk.paths])].sort(),
    });
  });

  return [...deduped.values()];
}

function mapAuditRiskToDependabotAlert(risk) {
  const patchedVersion = normalizePatchedVersionValue(risk.patchedVersions);
  return {
    alertNumber: `audit:${risk.packageName}:${risk.advisoryId}`,
    htmlUrl: risk.source,
    manifestPath: null,
    packageName: risk.packageName,
    patchAvailable: Boolean(patchedVersion),
    patchedVersion,
    severity: normalizeSeverity(risk.severity),
    source: 'dependabot',
    state: 'open',
    summary: risk.title,
  };
}

async function loadAuditReport(registry) {
  return new Promise((resolve, reject) => {
    const auditArgs = ['audit', '--json', `--registry=${registry}`];
    const child = process.platform === 'win32'
      ? spawn(process.env.comspec || 'cmd.exe', ['/d', '/s', '/c', `pnpm ${auditArgs.join(' ')}`], {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : spawn('pnpm', auditArgs, {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => {
      if (!stdout.trim()) {
        reject(new Error(`pnpm audit produced no JSON output. ${stderr.trim()}`.trim()));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Failed to parse pnpm audit JSON output: ${error.message}`));
      }
    });
  });
}

async function fetchGitHubApiPage({ owner, repo, endpoint, page, token }) {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/${endpoint}`);
  url.searchParams.set('state', 'open');
  url.searchParams.set('per_page', '100');
  url.searchParams.set('page', String(page));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return {
    ok: response.ok,
    payload,
    status: response.status,
  };
}

async function fetchRepositoryAlerts({ owner, repo, token, endpoint, normalizer }) {
  const alerts = [];
  let page = 1;

  while (true) {
    const result = await fetchGitHubApiPage({ endpoint, owner, page, repo, token });
    if (!result.ok) {
      const detail = String(result.payload?.message || `HTTP ${result.status}`).trim();
      return {
        alerts: [],
        sourceStatus: {
          detail,
          kind: result.status === 403 ? 'permission-denied' : 'unavailable',
          sourceName: 'github-api',
        },
      };
    }

    const items = toArray(result.payload);
    alerts.push(...items.map(normalizer));
    if (items.length < 100) {
      return {
        alerts,
        sourceStatus: {
          detail: `Fetched ${alerts.length} open alerts.`,
          kind: 'ok',
          sourceName: 'github-api',
        },
      };
    }

    page += 1;
  }
}

function countBySeverity(alerts) {
  return alerts.reduce((result, alert) => {
    result[alert.severity] = (result[alert.severity] || 0) + 1;
    return result;
  }, {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    note: 0,
  });
}

function determineFocusSeverity({ alerts, focusThreshold, includeMediumWhenClear, minSeverity }) {
  if (minSeverity) {
    return minSeverity;
  }

  const counts = countBySeverity(alerts);
  const highPlusCount = counts.critical + counts.high;

  if (counts.critical > 0 && highPlusCount >= focusThreshold) {
    return 'critical';
  }
  if (highPlusCount > 0) {
    return 'high';
  }
  if (includeMediumWhenClear && counts.medium > 0) {
    return 'medium';
  }
  return 'low';
}

function sortAlerts(alerts) {
  return [...alerts].sort((left, right) => {
    const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    if (left.source !== right.source) {
      return left.source === 'dependabot' ? -1 : 1;
    }

    if (left.patchAvailable !== right.patchAvailable) {
      return left.patchAvailable ? -1 : 1;
    }

    return String(left.packageName || left.ruleId || '').localeCompare(String(right.packageName || right.ruleId || ''));
  });
}

function buildPackageCandidates(alerts) {
  const grouped = new Map();

  alerts
    .filter((alert) => alert.source === 'dependabot' && alert.patchAvailable)
    .forEach((alert) => {
      const key = `${alert.packageName}:${alert.manifestPath || ''}`;
      const current = grouped.get(key);
      const next = current || {
        alertCount: 0,
        manifestPath: alert.manifestPath,
        packageName: alert.packageName,
        patchedVersions: new Set(),
        severity: alert.severity,
      };

      next.alertCount += 1;
      next.patchedVersions.add(alert.patchedVersion);
      if (SEVERITY_RANK[alert.severity] > SEVERITY_RANK[next.severity]) {
        next.severity = alert.severity;
      }
      grouped.set(key, next);
    });

  return [...grouped.values()]
    .map((item) => ({
      alertCount: item.alertCount,
      manifestPath: item.manifestPath,
      packageName: item.packageName,
      patchedVersions: [...item.patchedVersions].filter(Boolean).sort(),
      severity: item.severity,
    }))
    .sort((left, right) => {
      const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return right.alertCount - left.alertCount;
    });
}

function renderMarkdown(payload) {
  const lines = [
    '# Security Alert Snapshot',
    '',
    `- generatedAt: ${payload.generatedAt}`,
    `- repository: ${payload.repository ? `${payload.repository.owner}/${payload.repository.repo}` : 'unknown'}`,
    `- focusSeverity: ${payload.focusSeverity}`,
    `- dependabot source: ${payload.sourceStatuses.dependabot.kind} (${payload.sourceStatuses.dependabot.sourceName})`,
    `- code scanning source: ${payload.sourceStatuses.codeScanning.kind} (${payload.sourceStatuses.codeScanning.sourceName})`,
    '',
    '## Counts',
    `- total alerts: ${payload.alerts.length}`,
    `- relevant alerts: ${payload.relevantAlerts.length}`,
    `- fixable Dependabot: ${payload.fixableDependabot.length}`,
    `- manual Code Scanning: ${payload.manualCodeScanning.length}`,
    `- unfixable high+ dependencies: ${payload.unfixableHighDependencyAlerts.length}`,
    '',
    '## Package Candidates',
  ];

  if (payload.packageCandidates.length === 0) {
    lines.push('- none');
  } else {
    payload.packageCandidates.forEach((item) => {
      lines.push(`- ${item.packageName} [${item.severity}] x${item.alertCount} -> ${item.patchedVersions.join(', ') || 'manual target'}`);
    });
  }

  lines.push('');
  lines.push('## Manual Code Scanning');
  if (payload.manualCodeScanning.length === 0) {
    lines.push('- none');
  } else {
    payload.manualCodeScanning.forEach((item) => {
      lines.push(`- ${item.ruleId} [${item.severity}] ${item.locationPath || 'unknown-path'}`);
    });
  }

  lines.push('');
  lines.push('## Unfixable High Dependencies');
  if (payload.unfixableHighDependencyAlerts.length === 0) {
    lines.push('- none');
  } else {
    payload.unfixableHighDependencyAlerts.forEach((item) => {
      lines.push(`- ${item.packageName} [${item.severity}] ${item.summary}`);
    });
  }

  return `${lines.join('\n')}\n`;
}

async function ensureParentDirectory(filePath) {
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
}

async function main() {
  const args = parseCommandLine(process.argv);
  const cwd = process.cwd();
  const token = resolveGitHubToken(args.token);

  let repository = null;
  let repositoryError = '';
  try {
    repository = await resolveRepository(args, cwd);
  } catch (error) {
    repositoryError = String(error?.message || error);
  }

  let dependabotResult = {
    alerts: [],
    sourceStatus: {
      detail: token ? repositoryError || 'Repository resolution failed.' : 'No GitHub token available.',
      kind: token ? 'unavailable' : 'missing-token',
      sourceName: 'github-api',
    },
  };
  let codeScanningResult = {
    alerts: [],
    sourceStatus: {
      detail: token ? repositoryError || 'Repository resolution failed.' : 'No GitHub token available.',
      kind: token ? 'unavailable' : 'missing-token',
      sourceName: 'github-api',
    },
  };

  if (token && repository) {
    [dependabotResult, codeScanningResult] = await Promise.all([
      fetchRepositoryAlerts({
        endpoint: 'dependabot/alerts',
        normalizer: normalizeDependabotAlert,
        owner: repository.owner,
        repo: repository.repo,
        token,
      }),
      fetchRepositoryAlerts({
        endpoint: 'code-scanning/alerts',
        normalizer: normalizeCodeScanningAlert,
        owner: repository.owner,
        repo: repository.repo,
        token,
      }),
    ]);
  }

  if (dependabotResult.sourceStatus.kind !== 'ok') {
    const auditReport = await loadAuditReport(args.registry);
    dependabotResult = {
      alerts: parseAuditReport(auditReport).map(mapAuditRiskToDependabotAlert),
      sourceStatus: {
        detail: 'Loaded dependency risks from pnpm audit fallback.',
        kind: 'fallback',
        sourceName: 'pnpm-audit',
      },
    };
  }

  const alerts = sortAlerts([
    ...dependabotResult.alerts.filter((item) => item.state === 'open'),
    ...codeScanningResult.alerts.filter((item) => item.state === 'open'),
  ]);

  const focusSeverity = determineFocusSeverity({
    alerts,
    focusThreshold: args.focusThreshold,
    includeMediumWhenClear: args.includeMediumWhenClear,
    minSeverity: args.minSeverity,
  });
  const relevantAlerts = alerts.filter((alert) => severityAtLeast(alert.severity, focusSeverity));
  const fixableDependabot = relevantAlerts.filter((alert) => alert.source === 'dependabot' && alert.patchAvailable);
  const manualCodeScanning = relevantAlerts.filter((alert) => alert.source === 'code-scanning');
  const unfixableHighDependencyAlerts = alerts.filter((alert) => (
    alert.source === 'dependabot'
    && severityAtLeast(alert.severity, 'high')
    && !alert.patchAvailable
  ));

  const payload = {
    alerts,
    counts: countBySeverity(alerts),
    fixableDependabot,
    focusSeverity,
    generatedAt: new Date().toISOString(),
    manualCodeScanning,
    packageCandidates: buildPackageCandidates(relevantAlerts),
    registry: args.registry,
    relevantAlerts,
    repository,
    sourceStatuses: {
      codeScanning: codeScanningResult.sourceStatus,
      dependabot: dependabotResult.sourceStatus,
    },
    unfixableHighDependencyAlerts,
  };

  if (args.outputJson) {
    await ensureParentDirectory(args.outputJson);
    await writeFile(path.resolve(args.outputJson), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  if (args.outputMarkdown) {
    await ensureParentDirectory(args.outputMarkdown);
    await writeFile(path.resolve(args.outputMarkdown), renderMarkdown(payload), 'utf8');
  }

  console.info(`focusSeverity=${payload.focusSeverity}`);
  console.info(`alerts=${payload.alerts.length}`);
  console.info(`relevant=${payload.relevantAlerts.length}`);
  console.info(`fixableDependabot=${payload.fixableDependabot.length}`);
  console.info(`manualCodeScanning=${payload.manualCodeScanning.length}`);
  console.info(`unfixableHighDependencyAlerts=${payload.unfixableHighDependencyAlerts.length}`);

  payload.packageCandidates.slice(0, 10).forEach((item) => {
    console.info(`candidate ${item.packageName} [${item.severity}] -> ${item.patchedVersions.join(', ') || 'manual target'}`);
  });
}

main().catch((error) => {
  console.error(`[collect-security-alerts] ${error.message}`);
  process.exitCode = 1;
});
