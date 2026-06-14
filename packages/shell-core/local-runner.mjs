import { spawn } from 'node:child_process';

export const ALLOWLISTED_LOCAL_RUNNER_ACTIONS = [
  'repo.status',
  'repo.recent_commits',
  'service.puma_status',
  'service.sidekiq_status',
  'workspace.open_sourcegrid_dashboard',
  'workspace.open_commanddeck_repo',
  'workspace.open_url'
];

const ACTIONS = {
  'repo.status': runRepoStatus,
  'repo.recent_commits': runRecentCommits,
  'service.puma_status': runPumaStatus,
  'service.sidekiq_status': runSidekiqStatus,
  'workspace.open_sourcegrid_dashboard': runOpenSourceGridDashboard,
  'workspace.open_commanddeck_repo': runOpenCommandDeckRepo,
  'workspace.open_url': runOpenUrlTarget
};

export async function runAllowlistedLocalAction(actionId, options = {}) {
  const action = ACTIONS[actionId];

  if (!action) {
    throw new Error(`runner action is not allowlisted: ${actionId}`);
  }

  return action(options);
}

async function runRepoStatus(options) {
  const result = await execAllowlistedCommand(
    {
      command: 'git',
      args: ['status', '--short', '--branch'],
      cwd: options.rootDir
    },
    options.executor
  );
  const lines = splitLines(result.stdout);
  const statusLine = lines[0]?.replace(/^##\s*/, '') ?? 'unknown';
  const changedEntries = lines.slice(1);

  return {
    status: 'executed_local_exact_command',
    summary:
      changedEntries.length === 0
        ? `Repo status: ${statusLine}; no local file changes.`
        : `Repo status: ${statusLine}; ${changedEntries.length} local file change${pluralize(changedEntries.length)}.`,
    data: {
      runner_action: 'repo.status',
      status_line: statusLine,
      changed_entries: changedEntries
    }
  };
}

async function runRecentCommits(options) {
  const result = await execAllowlistedCommand(
    {
      command: 'git',
      args: ['log', '--oneline', '--decorate', '-3'],
      cwd: options.rootDir
    },
    options.executor
  );
  const commits = splitLines(result.stdout).map((line) => {
    const [commit, ...rest] = line.split(' ');
    return {
      commit,
      summary: rest.join(' ')
    };
  });

  return {
    status: 'executed_local_exact_command',
    summary:
      commits.length === 0
        ? 'No recent commits were returned for this repo.'
        : `Loaded ${commits.length} recent commit${pluralize(commits.length)} from the current repo.`,
    data: {
      runner_action: 'repo.recent_commits',
      commits
    }
  };
}

async function runPumaStatus(options) {
  return runProcessMatch({
    actionId: 'service.puma_status',
    pattern: /\b(puma|rails server)\b/i,
    runningSummary: (count) => `Puma appears to be running in ${count} ${pluralizeWord(count, 'process', 'processes')}.`,
    stoppedSummary: 'Puma does not appear to be running.'
  }, options);
}

async function runSidekiqStatus(options) {
  return runProcessMatch({
    actionId: 'service.sidekiq_status',
    pattern: /\bsidekiq\b/i,
    runningSummary: (count) => `Sidekiq appears to be running in ${count} ${pluralizeWord(count, 'process', 'processes')}.`,
    stoppedSummary: 'Sidekiq does not appear to be running.'
  }, options);
}

async function runOpenSourceGridDashboard(options) {
  await execAllowlistedCommand(
    {
      command: 'open',
      args: ['https://sourcegrid.app/'],
      cwd: options.rootDir
    },
    options.executor
  );

  return {
    status: 'executed_local_approved_action',
    summary: 'Opened the SourceGrid dashboard.',
    data: {
      runner_action: 'workspace.open_sourcegrid_dashboard',
      opened_target: 'https://sourcegrid.app/'
    }
  };
}

async function runOpenCommandDeckRepo(options) {
  await execAllowlistedCommand(
    {
      command: 'open',
      args: ['.'],
      cwd: options.rootDir
    },
    options.executor
  );

  return {
    status: 'executed_local_approved_action',
    summary: 'Opened the current CommandDeck repo.',
    data: {
      runner_action: 'workspace.open_commanddeck_repo',
      opened_target: '.'
    }
  };
}

async function runOpenUrlTarget(options) {
  const target = options.target;
  const value = target?.value;

  if (!target || typeof value !== 'string') {
    throw new Error('workspace.open_url requires a resolved target value');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`workspace.open_url target is not a valid URL: ${value}`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`workspace.open_url target URL is not allowed: ${value}`);
  }

  await execAllowlistedCommand(
    {
      command: 'open',
      args: [url.toString()],
      cwd: options.rootDir
    },
    options.executor
  );

  return {
    status: 'executed_local_approved_action',
    summary: `Opened ${target.display_name ?? url.toString()}.`,
    data: {
      runner_action: 'workspace.open_url',
      opened_target: url.toString(),
      resolved_target: sanitizeResolvedTarget(target)
    }
  };
}

function sanitizeResolvedTarget(target) {
  return {
    target_id: target.target_id,
    kind: target.kind,
    display_name: target.display_name,
    environment: target.environment ?? null,
    value: target.value
  };
}

async function runProcessMatch(definition, options) {
  const result = await execAllowlistedCommand(
    {
      command: 'ps',
      args: ['-ef'],
      cwd: options.rootDir
    },
    options.executor
  );
  const matches = splitLines(result.stdout)
    .map(parsePsEfLine)
    .filter((processInfo) => processInfo && !shouldIgnoreProcessLine(processInfo.command))
    .filter((processInfo) => definition.pattern.test(processInfo.command));

  return {
    status: 'executed_local_exact_command',
    summary: matches.length > 0 ? definition.runningSummary(matches.length) : definition.stoppedSummary,
    data: {
      runner_action: definition.actionId,
      running: matches.length > 0,
      process_count: matches.length,
      processes: matches.map((processInfo) => ({
        pid: processInfo.pid,
        command: truncateProcessCommand(processInfo.command)
      }))
    }
  };
}

async function execAllowlistedCommand(spec, executor = defaultExecutor) {
  const result = await executor(spec);

  if (result.exitCode !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    const detail = stderr ? `: ${stderr}` : '';
    throw new Error(`${spec.command} ${spec.args.join(' ')} failed${detail}`);
  }

  return {
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? '')
  };
}

async function defaultExecutor(spec) {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr
      });
    });
  });
}

function splitLines(value) {
  return String(value)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

function pluralize(count) {
  return count === 1 ? '' : 's';
}

function pluralizeWord(count, singular, plural) {
  return count === 1 ? singular : plural;
}

function parsePsEfLine(line) {
  if (/^\s*UID\s+PID\s+PPID\s+/i.test(line)) {
    return null;
  }

  const match = line.match(/^\s*(\S+)\s+(\d+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    uid: match[1],
    pid: match[2],
    ppid: match[3],
    command: match[4]
  };
}

function shouldIgnoreProcessLine(command) {
  return [
    /\bnode\s+bin\/command-deck\.mjs\b/,
    /\bnpm\s+run\s+command:local\b/,
    /Codex Computer Use\.app/,
    /\bps\s+-ef\b/
  ].some((pattern) => pattern.test(command));
}

function truncateProcessCommand(command) {
  const value = String(command);
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}
