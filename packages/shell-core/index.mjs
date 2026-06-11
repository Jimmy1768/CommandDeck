import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ACTOR = 'local_prototype';
const DEFAULT_ADAPTER = 'local_cli';
const DEFAULT_CONFIG_PATH = 'commandkit.config.json';
const DEFAULT_COMMAND_PACK_PATH = 'contracts/commands/mvp-commands.json';
const DEFAULT_RECORD_DIR = 'records/actions';
const DEFAULT_CONFIG = {
  schema_version: '0.1',
  default_command_pack: DEFAULT_COMMAND_PACK_PATH,
  default_record_dir: DEFAULT_RECORD_DIR,
  default_write_records: false
};
const FORBIDDEN_ALLOWED_EFFECTS = new Set([
  'payment',
  'production_deploy',
  'production_restart',
  'migration',
  'customer_data_mutation',
  'public_message',
  'external_party_contact',
  'infrastructure_mutation',
  'secret_write',
  'execute_now',
  'execute_without_approval',
  'external_call',
  'provider_call'
]);
const FORBIDDEN_COMMAND_FIELDS = ['script', 'scripts', 'shell', 'executable', 'handler', 'env', 'secrets'];
const FORBIDDEN_CONFIG_FIELDS = ['provider_keys', 'secrets', 'env', 'execute_now_enabled'];
const FORBIDDEN_ADAPTER_REQUEST_FIELDS = [
  'provider_keys',
  'secrets',
  'env',
  'token',
  'tokens',
  'authorization',
  'password'
];
const ALLOWED_ADAPTERS = new Set(['apple_shortcuts', 'local_cli']);
const ALLOWED_REQUESTED_OUTPUTS = new Set(['spoken_summary', 'display_text', 'json']);
const REQUIRED_COMMAND_FIELDS = [
  'command_id',
  'title',
  'example_utterances',
  'permission_level',
  'route',
  'allowed_effects',
  'forbidden_effects',
  'sources'
];

export async function runLocalCommand(input, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const timestamp = options.timestamp ?? new Date().toISOString();
  const routes = await readJson(rootDir, 'contracts/routes/route-contracts.json');
  const permissions = await readJson(rootDir, 'contracts/permissions/permission-levels.json');
  const pack = await loadCommandPack({
    rootDir,
    commandPackPath: options.commandPackPath,
    routes,
    permissions
  });

  assertExecuteNowDisabled(permissions);

  const commandText = input.command_text ?? input.commandText ?? '';
  const command = classifyCommand(pack.commands, commandText);

  if (!command) {
    return buildFailureRecord({
      input,
      timestamp,
      commandText,
      summary: 'CommandKit could not classify this command from the slice 1 command pack.'
    });
  }

  const route = routes.routes.find((candidate) => candidate.id === command.route);
  if (!route || route.real_integration !== false) {
    return buildFailureRecord({
      input,
      timestamp,
      commandText,
      command,
      summary: 'Command route is missing or not contract-only.'
    });
  }

  const sources = await Promise.all(command.sources.map((source) => readJson(rootDir, source)));
  const result = evaluateFixtureCommand(command, sources);
  const approvalStatus = approvalStatusFor(command.permission_level);

  return {
    response_text: responseFor(result, approvalStatus),
    record: {
      record_id: stableId('rec', [command.command_id, commandText, timestamp]),
      command_id: command.command_id,
      timestamp,
      actor_ref: input.actor_ref ?? DEFAULT_ACTOR,
      adapter: input.adapter ?? DEFAULT_ADAPTER,
      command_text: commandText,
      interpreted_intent: command.title,
      permission_level: command.permission_level,
      approval_status: approvalStatus,
      route: command.route,
      sources_used: command.sources,
      model_provider_route: null,
      action_key: null,
      result,
      errors: [],
      follow_up_owner: followUpOwnerFor(command.permission_level)
    }
  };
}

export function classifyCommand(commands, commandText) {
  const normalizedInput = normalizeUtterance(commandText);

  return commands.find((command) => {
    return command.example_utterances.some((utterance) => normalizeUtterance(utterance) === normalizedInput);
  });
}

export function normalizeUtterance(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function loadCommandPack(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const commandPackPath = options.commandPackPath ?? DEFAULT_COMMAND_PACK_PATH;
  const routes = options.routes ?? (await readJson(rootDir, 'contracts/routes/route-contracts.json'));
  const permissions = options.permissions ?? (await readJson(rootDir, 'contracts/permissions/permission-levels.json'));
  const pack = await readRepoRelativeJson(rootDir, commandPackPath);
  const errors = validateCommandPack(pack, { routes, permissions });

  if (errors.length > 0) {
    throw new Error(`invalid command pack ${commandPackPath}: ${errors.join('; ')}`);
  }

  return pack;
}

export async function loadCommandKitConfig(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;

  if (!options.configPath && !(await pathExists(path.join(rootDir, configPath)))) {
    return { ...DEFAULT_CONFIG, config_path: null };
  }

  const config = await readRepoRelativeJson(rootDir, configPath);
  const errors = validateCommandKitConfig(config, { rootDir });

  if (errors.length > 0) {
    throw new Error(`invalid CommandKit config ${configPath}: ${errors.join('; ')}`);
  }

  return {
    ...DEFAULT_CONFIG,
    ...config,
    config_path: configPath
  };
}

export async function loadAdapterRequest(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const requestPath = options.requestPath;

  if (!requestPath) {
    throw new Error('requestPath is required');
  }

  const request = await readRepoRelativeJson(rootDir, requestPath);
  const errors = validateAdapterRequest(request);

  if (errors.length > 0) {
    throw new Error(`invalid adapter request ${requestPath}: ${errors.join('; ')}`);
  }

  return request;
}

export async function runEvalSuite(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const suitePath = options.suitePath ?? 'evals/cases/mvp.slice1.cases.json';
  const commandPackPath = options.commandPackPath ?? DEFAULT_COMMAND_PACK_PATH;
  const timestamp = options.timestamp ?? new Date().toISOString();
  const suite = await readRepoRelativeJson(rootDir, suitePath);
  const caseResults = [];

  for (const evalCase of suite.cases ?? []) {
    const commandResult = await runLocalCommand(evalCase.input, {
      rootDir,
      commandPackPath,
      timestamp
    });
    const checks = compareEvalCase(evalCase, commandResult);

    caseResults.push({
      case_id: evalCase.case_id,
      command_id: evalCase.command_id,
      passed: checks.every((check) => check.passed),
      checks,
      response_text: commandResult.response_text,
      record: commandResult.record
    });
  }

  const passed = caseResults.filter((result) => result.passed).length;
  const failed = caseResults.length - passed;

  return {
    suite_id: suite.suite_id,
    suite_path: suitePath,
    command_pack_path: commandPackPath,
    timestamp,
    summary: {
      total: caseResults.length,
      passed,
      failed
    },
    cases: caseResults
  };
}

export async function writeEvalReport(report, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const reportPath = options.reportPath ?? `evals/reports/${report.suite_id}.latest.json`;
  const resolvedPath = resolveEvalReportPath(rootDir, reportPath);

  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(report, null, 2)}\n`, { flag: options.overwrite ? 'w' : 'wx' });

  return {
    report_path: path.relative(rootDir, resolvedPath)
  };
}

export function validateAdapterRequest(request) {
  const errors = [];

  if (!request || typeof request !== 'object') {
    return ['request must be an object'];
  }

  const forbiddenFields = findForbiddenFields(request, FORBIDDEN_ADAPTER_REQUEST_FIELDS);
  for (const field of forbiddenFields) {
    errors.push(`request includes forbidden field ${field}`);
  }

  if (!ALLOWED_ADAPTERS.has(request.adapter)) {
    errors.push(`adapter must be one of ${[...ALLOWED_ADAPTERS].join(', ')}`);
  }

  if (!request.actor_ref || typeof request.actor_ref !== 'string') {
    errors.push('actor_ref is required');
  }

  if (!request.command_text || typeof request.command_text !== 'string') {
    errors.push('command_text is required');
  }

  if (!ALLOWED_REQUESTED_OUTPUTS.has(request.requested_output)) {
    errors.push(`requested_output must be one of ${[...ALLOWED_REQUESTED_OUTPUTS].join(', ')}`);
  }

  if (request.device_context && typeof request.device_context !== 'object') {
    errors.push('device_context must be an object when provided');
  }

  return errors;
}

export function compareEvalCase(evalCase, commandResult) {
  const expected = evalCase.expected;
  const record = commandResult.record;

  return [
    {
      name: 'command_id',
      expected: evalCase.command_id,
      actual: record.command_id,
      passed: record.command_id === evalCase.command_id
    },
    {
      name: 'permission_level',
      expected: expected.permission_level,
      actual: record.permission_level,
      passed: record.permission_level === expected.permission_level
    },
    {
      name: 'route',
      expected: expected.route,
      actual: record.route,
      passed: record.route === expected.route
    },
    {
      name: 'approval_status',
      expected: expected.approval_status,
      actual: record.approval_status,
      passed: record.approval_status === expected.approval_status
    },
    {
      name: 'result_status',
      expected: expected.result_status,
      actual: record.result.status,
      passed: record.result.status === expected.result_status
    }
  ];
}

export function validateCommandKitConfig(config, { rootDir }) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return ['config must be an object'];
  }

  for (const field of FORBIDDEN_CONFIG_FIELDS) {
    if (field in config) {
      errors.push(`config includes forbidden field ${field}`);
    }
  }

  if (config.schema_version !== '0.1') {
    errors.push('schema_version must be 0.1');
  }

  if (config.default_write_records !== false) {
    errors.push('default_write_records must remain false in Phase 1');
  }

  try {
    resolveRepoRelativePath(rootDir, config.default_command_pack ?? DEFAULT_COMMAND_PACK_PATH);
  } catch (error) {
    errors.push(`default_command_pack ${error.message}`);
  }

  try {
    resolveRecordDir(rootDir, config.default_record_dir ?? DEFAULT_RECORD_DIR);
  } catch (error) {
    errors.push(`default_record_dir ${error.message}`);
  }

  return errors;
}

export function validateCommandPack(pack, { routes, permissions }) {
  const errors = [];
  const routeById = new Map(routes.routes.map((route) => [route.id, route]));
  const allowedPermissionLevels = new Set(
    permissions.levels.filter((level) => level.id !== 'execute-now').map((level) => level.id)
  );

  if (!pack || typeof pack !== 'object') {
    return ['pack must be an object'];
  }

  for (const field of ['pack_id', 'owner', 'permissions', 'record_policy', 'commands']) {
    if (!(field in pack)) {
      errors.push(`missing pack field ${field}`);
    }
  }

  if (!Array.isArray(pack.commands) || pack.commands.length === 0) {
    errors.push('commands must be a non-empty array');
    return errors;
  }

  for (const command of pack.commands) {
    const commandId = command?.command_id ?? '<unknown>';

    if (!command || typeof command !== 'object') {
      errors.push(`${commandId} command must be an object`);
      continue;
    }

    for (const field of REQUIRED_COMMAND_FIELDS) {
      if (!(field in command)) {
        errors.push(`${commandId} missing command field ${field}`);
      }
    }

    for (const field of FORBIDDEN_COMMAND_FIELDS) {
      if (field in command) {
        errors.push(`${commandId} includes forbidden executable field ${field}`);
      }
    }

    if (!allowedPermissionLevels.has(command.permission_level)) {
      errors.push(`${commandId} has unsupported permission level ${command.permission_level}`);
    }

    const route = routeById.get(command.route);
    if (!route) {
      errors.push(`${commandId} references unknown route ${command.route}`);
    } else {
      if (route.real_integration !== false) {
        errors.push(`${commandId} route ${command.route} is not contract-only`);
      }

      if (!route.allowed_permission_levels.includes(command.permission_level)) {
        errors.push(`${commandId} permission ${command.permission_level} is not allowed by route ${command.route}`);
      }
    }

    if (!Array.isArray(command.example_utterances) || command.example_utterances.length === 0) {
      errors.push(`${commandId} must include at least one example utterance`);
    }

    if (!Array.isArray(command.allowed_effects)) {
      errors.push(`${commandId} allowed_effects must be an array`);
    } else {
      const illegalEffects = command.allowed_effects.filter((effect) => FORBIDDEN_ALLOWED_EFFECTS.has(effect));
      if (illegalEffects.length > 0) {
        errors.push(`${commandId} allows forbidden effects ${illegalEffects.join(', ')}`);
      }
    }

    if (command.permission_level === 'approval-required' && !command.approval_prompt) {
      errors.push(`${commandId} approval-required command must define approval_prompt`);
    }

    if (!Array.isArray(command.sources)) {
      errors.push(`${commandId} sources must be an array`);
    } else {
      for (const source of command.sources) {
        if (!isSafeFixtureSource(source)) {
          errors.push(`${commandId} source must be repo-relative under evals/fixtures: ${source}`);
        }
      }
    }
  }

  return errors;
}

export async function writeActionRecord(record, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const recordDir = resolveRecordDir(rootDir, options.recordDir ?? DEFAULT_RECORD_DIR);
  const recordPath = path.join(recordDir, `${record.record_id}.json`);

  await mkdir(recordDir, { recursive: true });
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });

  return {
    record_path: path.relative(rootDir, recordPath)
  };
}

export function resolveRecordDir(rootDir, recordDir) {
  if (path.isAbsolute(recordDir)) {
    throw new Error('record directory must be repo-relative');
  }

  const resolvedRoot = path.resolve(rootDir);
  const resolvedRecordDir = path.resolve(resolvedRoot, recordDir);
  const relative = path.relative(resolvedRoot, resolvedRecordDir);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('record directory must stay inside the repo');
  }

  return resolvedRecordDir;
}

export function resolveEvalReportPath(rootDir, reportPath) {
  const resolvedPath = resolveRepoRelativePath(rootDir, reportPath);
  const resolvedRoot = path.resolve(rootDir);
  const relative = path.relative(resolvedRoot, resolvedPath);
  const normalized = relative.split(path.sep).join(path.posix.sep);

  if (!normalized.startsWith('evals/reports/')) {
    throw new Error('eval report path must stay under evals/reports');
  }

  if (!normalized.endsWith('.json')) {
    throw new Error('eval report path must be a JSON file');
  }

  return resolvedPath;
}

async function readJson(rootDir, relativePath) {
  const contents = await readFile(path.join(rootDir, relativePath), 'utf8');
  return JSON.parse(contents);
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function readRepoRelativeJson(rootDir, relativePath) {
  const resolvedPath = resolveRepoRelativePath(rootDir, relativePath);
  const contents = await readFile(resolvedPath, 'utf8');
  return JSON.parse(contents);
}

function resolveRepoRelativePath(rootDir, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error('path must be repo-relative');
  }

  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolvedPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('path must stay inside the repo');
  }

  return resolvedPath;
}

function isSafeFixtureSource(source) {
  if (typeof source !== 'string' || path.isAbsolute(source)) {
    return false;
  }

  const normalized = path.posix.normalize(source);
  return normalized === source && normalized.startsWith('evals/fixtures/') && !normalized.includes('../');
}

function findForbiddenFields(value, forbiddenFields, prefix = '') {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const matches = [];
  for (const [key, child] of Object.entries(value)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (forbiddenFields.includes(key)) {
      matches.push(fieldPath);
    }

    matches.push(...findForbiddenFields(child, forbiddenFields, fieldPath));
  }

  return matches;
}

function assertExecuteNowDisabled(permissions) {
  const executeNow = permissions.levels.find((level) => level.id === 'execute-now');

  if (permissions.execute_now_default !== 'disabled' || executeNow?.enabled !== false) {
    throw new Error('execute-now must remain disabled for the local prototype');
  }
}

function evaluateFixtureCommand(command, sources) {
  switch (command.command_id) {
    case 'mvp.next_sourcegrid_task': {
      const nextTask = [...sources[0].items].sort((a, b) => a.priority - b.priority)[0];
      return {
        status: 'answered_from_fixture',
        summary: `Next task: ${nextTask.title}.`,
        data: { task_id: nextTask.id }
      };
    }
    case 'mvp.operator_queue_today': {
      const openItems = sources[0].items.filter((item) => item.status !== 'done');
      return {
        status: 'answered_from_fixture',
        summary: `${openItems.length} operator queue items are open in the fixture.`,
        data: { open_item_ids: openItems.map((item) => item.id) }
      };
    }
    case 'mvp.draft_handoff': {
      const task = sources[0].task;
      return {
        status: 'drafted_fixture_only',
        summary: `Draft handoff prepared for ${task.title}.`,
        data: {
          draft: {
            task_id: task.id,
            scope: task.goal,
            checklist: task.handoff_requirements
          }
        }
      };
    }
    case 'mvp.operatorkit_dry_run':
      return {
        status: 'blocked_contract_only',
        summary: 'OperatorKit dry run was not started because slice 1 is contract-only.',
        data: { blocked_reason: 'execute-now disabled and OperatorKit integration unavailable' }
      };
    case 'mvp.apprelay_changes_today':
      return {
        status: 'answered_from_fixture',
        summary: sources[0].changes.map((change) => change.summary).join(' '),
        data: { real_apprelay_read: false }
      };
    default:
      return {
        status: 'blocked_contract_only',
        summary: 'No fixture evaluator exists for this command.',
        data: {}
      };
  }
}

function approvalStatusFor(permissionLevel) {
  return permissionLevel === 'approval-required' ? 'blocked_execute_now_disabled' : 'not_required';
}

function followUpOwnerFor(permissionLevel) {
  return permissionLevel === 'approval-required' ? 'human_operator' : null;
}

function responseFor(result, approvalStatus) {
  if (approvalStatus === 'blocked_execute_now_disabled') {
    return `${result.summary} Approval would be required in a future phase.`;
  }

  return result.summary;
}

function buildFailureRecord({ input, timestamp, commandText, command, summary }) {
  return {
    response_text: summary,
    record: {
      record_id: stableId('rec', [command?.command_id ?? 'unknown', commandText, timestamp]),
      command_id: command?.command_id ?? 'unknown',
      timestamp,
      actor_ref: input.actor_ref ?? DEFAULT_ACTOR,
      adapter: input.adapter ?? DEFAULT_ADAPTER,
      command_text: commandText,
      interpreted_intent: command?.title ?? 'unclassified',
      permission_level: command?.permission_level ?? 'read-only',
      approval_status: 'required_not_requested',
      route: command?.route ?? 'none',
      sources_used: command?.sources ?? [],
      model_provider_route: null,
      action_key: null,
      result: {
        status: 'failed_closed',
        summary
      },
      errors: [summary],
      follow_up_owner: 'human_operator'
    }
  };
}

function stableId(prefix, parts) {
  const digest = createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
  return `${prefix}_${digest}`;
}
