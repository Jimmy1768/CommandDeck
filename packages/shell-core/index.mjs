import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ACTOR = 'local_prototype';
const DEFAULT_ADAPTER = 'local_cli';
const DEFAULT_CONFIG_PATH = 'commanddeck.config.json';
const DEFAULT_COMMAND_PACK_PATH = 'contracts/commands/mvp-commands.json';
const DEFAULT_RECORD_DIR = 'records/actions';
const DEFAULT_SOURCEGRID_ATTACHMENT = {
  schema_version: '0.1',
  status: 'not_attached',
  sourcegrid_workspace_ref: null,
  sourcegrid_account_ref: null,
  billing_owner: 'sourcegrid_workspace',
  payment_method_state: 'missing',
  payment_method_label: null,
  apprelay_spend_policy: 'disabled_until_payment_verified',
  command_pack_owner_repos: []
};
const DEFAULT_CONFIG = {
  schema_version: '0.1',
  default_command_pack: DEFAULT_COMMAND_PACK_PATH,
  default_record_dir: DEFAULT_RECORD_DIR,
  default_write_records: false,
  sourcegrid_attachment: DEFAULT_SOURCEGRID_ATTACHMENT
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
const FORBIDDEN_CONFIG_FIELDS = [
  'provider_keys',
  'secrets',
  'env',
  'execute_now_enabled',
  'card_number',
  'cvv',
  'cvc',
  'raw_payment_method',
  'payment_token',
  'stripe_secret_key',
  'stripe_publishable_key',
  'stripe_payment_method_id'
];
const FORBIDDEN_DISCOVERY_ROOT_FIELDS = [
  ...FORBIDDEN_CONFIG_FIELDS,
  'script',
  'scripts',
  'shell',
  'executable',
  'handler'
];
const ALLOWED_DISCOVERY_ROOT_KINDS = new Set(['repo-fixture', 'owner-repo', 'local-folder']);
const ALLOWED_DISCOVERY_MODES = new Set(['metadata_only']);
const ALLOWED_SOURCEGRID_ATTACHMENT_STATUSES = new Set(['not_attached', 'contract_only', 'attached']);
const ALLOWED_PAYMENT_METHOD_STATES = new Set(['missing', 'verified', 'not_required_contract_only']);
const ALLOWED_APPRELAY_SPEND_POLICIES = new Set([
  'disabled_until_payment_verified',
  'contract_only_no_spend',
  'enabled_after_payment_verified'
]);
const FORBIDDEN_ADAPTER_REQUEST_FIELDS = [
  'provider_keys',
  'secrets',
  'env',
  'token',
  'tokens',
  'authorization',
  'password',
  'approval',
  'approval_decision',
  'approval_request',
  'approval_status'
];
const ALLOWED_ADAPTERS = new Set(['apple_shortcuts', 'google_voice', 'local_cli']);
const ALLOWED_REQUESTED_OUTPUTS = new Set(['spoken_summary', 'display_text', 'json']);
const ALLOWED_SURFACE_HINTS = new Set(['phone', 'watch', 'glasses', 'computer']);
const ALLOWED_TARGET_RUNNERS = new Set(['command']);
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
      summary: 'CommandDeck could not classify this command from the slice 1 command pack.'
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
  const responseText = responseFor(result, approvalStatus);
  const record = {
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
    approval_request: approvalRequestFor(command),
    result,
    errors: [],
    follow_up_owner: followUpOwnerFor(command.permission_level)
  };

  return buildCommandResult({
    input,
    responseText,
    record
  });
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

export async function loadCommandDeckConfig(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;

  if (!options.configPath && !(await pathExists(path.join(rootDir, configPath)))) {
    return { ...DEFAULT_CONFIG, config_path: null };
  }

  const config = await readRepoRelativeJson(rootDir, configPath);
  const errors = validateCommandDeckConfig(config, { rootDir });

  if (errors.length > 0) {
    throw new Error(`invalid CommandDeck config ${configPath}: ${errors.join('; ')}`);
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
      adapter_response: commandResult.adapter_response,
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

export async function runApprovalDecisionEvalSuite(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const suitePath = options.suitePath ?? 'evals/cases/approval.slice1.cases.json';
  const suite = await readRepoRelativeJson(rootDir, suitePath);
  const caseResults = [];

  for (const evalCase of suite.cases ?? []) {
    const record = await readRepoRelativeJson(rootDir, evalCase.record_fixture);
    const decision = await readRepoRelativeJson(rootDir, evalCase.decision_fixture);
    const decisionResult = applyApprovalDecision(record, decision, {
      now: evalCase.now
    });
    const checks = compareApprovalDecisionEvalCase(evalCase, decisionResult);

    caseResults.push({
      case_id: evalCase.case_id,
      passed: checks.every((check) => check.passed),
      checks,
      decision_result: decisionResult
    });
  }

  const passed = caseResults.filter((result) => result.passed).length;
  const failed = caseResults.length - passed;

  return {
    suite_id: suite.suite_id,
    suite_path: suitePath,
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

  if (request.adapter !== 'local_cli') {
    if (!request.surface_hint || typeof request.surface_hint !== 'string') {
      errors.push('surface_hint is required for voice adapter requests');
    } else if (!ALLOWED_SURFACE_HINTS.has(request.surface_hint)) {
      errors.push(`surface_hint must be one of ${[...ALLOWED_SURFACE_HINTS].join(', ')}`);
    }

    if (!request.target_runner || typeof request.target_runner !== 'string') {
      errors.push('target_runner is required for voice adapter requests');
    } else if (!ALLOWED_TARGET_RUNNERS.has(request.target_runner)) {
      errors.push(`target_runner must be one of ${[...ALLOWED_TARGET_RUNNERS].join(', ')}`);
    }
  }

  if (request.device_code && typeof request.device_code !== 'string') {
    errors.push('device_code must be a string when provided');
  }

  if (!ALLOWED_REQUESTED_OUTPUTS.has(request.requested_output)) {
    errors.push(`requested_output must be one of ${[...ALLOWED_REQUESTED_OUTPUTS].join(', ')}`);
  }

  if (request.device_context && typeof request.device_context !== 'object') {
    errors.push('device_context must be an object when provided');
  }

  return errors;
}

export function validateApprovalDecision(record, decision, options = {}) {
  const errors = [];
  const now = new Date(options.now ?? new Date().toISOString());

  if (!record || typeof record !== 'object') {
    return ['record must be an object'];
  }

  if (!decision || typeof decision !== 'object') {
    return ['decision must be an object'];
  }

  for (const field of ['decision_id', 'record_id', 'actor_ref', 'decision', 'decided_at', 'reason', 'scope', 'expires_at']) {
    if (!(field in decision)) {
      errors.push(`decision missing field ${field}`);
    }
  }

  if (!['approved', 'denied'].includes(decision.decision)) {
    errors.push('decision must be approved or denied');
  }

  if (decision.record_id !== record.record_id) {
    errors.push('decision record_id must match action record');
  }

  if (record.permission_level !== 'approval-required') {
    errors.push('action record must be approval-required');
  }

  if (!record.approval_request) {
    errors.push('action record must include approval_request');
  }

  if (!decision.scope || typeof decision.scope !== 'object') {
    errors.push('decision scope is required');
  } else if (record.approval_request) {
    if (decision.scope.target !== record.approval_request.target) {
      errors.push('decision scope target must match approval_request target');
    }

    if (decision.scope.action !== record.approval_request.action) {
      errors.push('decision scope action must match approval_request action');
    }
  }

  const expiresAt = new Date(decision.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    errors.push('expires_at must be a valid date-time');
  } else if (expiresAt <= now) {
    errors.push('approval decision is expired');
  }

  return errors;
}

export function applyApprovalDecision(record, decision, options = {}) {
  const errors = validateApprovalDecision(record, decision, options);
  const expired = errors.includes('approval decision is expired');

  if (errors.length > 0) {
    return {
      decision_id: decision?.decision_id ?? null,
      record_id: record?.record_id ?? null,
      decision_status: expired ? 'rejected_expired' : 'rejected_invalid',
      approval_status: record?.approval_status ?? 'required_not_requested',
      result: record?.result ?? {
        status: 'failed_closed',
        summary: 'Approval decision rejected.'
      },
      errors
    };
  }

  if (decision.decision === 'denied') {
    return {
      decision_id: decision.decision_id,
      record_id: record.record_id,
      decision_status: 'denied_no_execution',
      approval_status: 'denied',
      result: record.result,
      errors: []
    };
  }

  return {
    decision_id: decision.decision_id,
    record_id: record.record_id,
    decision_status: 'approved_execution_disabled',
    approval_status: 'approved',
    result: record.result,
    errors: []
  };
}

export function compareEvalCase(evalCase, commandResult) {
  const expected = evalCase.expected;
  const record = commandResult.record;

  const checks = [
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

  if ('approval_request_required' in expected) {
    const hasApprovalRequest = Boolean(record.approval_request);
    checks.push({
      name: 'approval_request_required',
      expected: expected.approval_request_required,
      actual: hasApprovalRequest,
      passed: hasApprovalRequest === expected.approval_request_required
    });
  }

  if (expected.adapter_response) {
    const adapterResponse = commandResult.adapter_response;

    for (const [field, expectedValue] of Object.entries(expected.adapter_response)) {
      checks.push({
        name: `adapter_response.${field}`,
        expected: expectedValue,
        actual: adapterResponse?.[field],
        passed: adapterResponse?.[field] === expectedValue
      });
    }

    checks.push({
      name: 'adapter_response.record_ref',
      expected: record.record_id,
      actual: adapterResponse?.record_ref,
      passed: adapterResponse?.record_ref === record.record_id
    });
  }

  return checks;
}

export function compareApprovalDecisionEvalCase(evalCase, decisionResult) {
  const expected = evalCase.expected;

  return [
    {
      name: 'decision_status',
      expected: expected.decision_status,
      actual: decisionResult.decision_status,
      passed: decisionResult.decision_status === expected.decision_status
    },
    {
      name: 'approval_status',
      expected: expected.approval_status,
      actual: decisionResult.approval_status,
      passed: decisionResult.approval_status === expected.approval_status
    },
    {
      name: 'result_status',
      expected: expected.result_status,
      actual: decisionResult.result.status,
      passed: decisionResult.result.status === expected.result_status
    }
  ];
}

export function validateCommandDeckConfig(config, { rootDir }) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return ['config must be an object'];
  }

  const forbiddenFields = findForbiddenFields(config, FORBIDDEN_CONFIG_FIELDS);
  for (const field of forbiddenFields) {
    errors.push(`config includes forbidden field ${field}`);
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

  errors.push(...validateCommandPackRoots(config.command_pack_roots, { rootDir }));
  errors.push(...validateSourceGridAttachment(config.sourcegrid_attachment));

  return errors;
}

export function validateSourceGridAttachment(attachment) {
  const errors = [];

  if (attachment === undefined) {
    return errors;
  }

  if (!attachment || typeof attachment !== 'object') {
    return ['sourcegrid_attachment must be an object'];
  }

  const forbiddenFields = findForbiddenFields(attachment, FORBIDDEN_CONFIG_FIELDS);
  for (const field of forbiddenFields) {
    errors.push(`sourcegrid_attachment includes forbidden field ${field}`);
  }

  for (const field of [
    'schema_version',
    'status',
    'billing_owner',
    'payment_method_state',
    'apprelay_spend_policy',
    'command_pack_owner_repos'
  ]) {
    if (!(field in attachment)) {
      errors.push(`sourcegrid_attachment missing field ${field}`);
    }
  }

  if (attachment.schema_version !== '0.1') {
    errors.push('sourcegrid_attachment schema_version must be 0.1');
  }

  if (!ALLOWED_SOURCEGRID_ATTACHMENT_STATUSES.has(attachment.status)) {
    errors.push(`sourcegrid_attachment status must be one of ${[...ALLOWED_SOURCEGRID_ATTACHMENT_STATUSES].join(', ')}`);
  }

  if (attachment.billing_owner !== 'sourcegrid_workspace') {
    errors.push('sourcegrid_attachment billing_owner must be sourcegrid_workspace');
  }

  if (!ALLOWED_PAYMENT_METHOD_STATES.has(attachment.payment_method_state)) {
    errors.push(`sourcegrid_attachment payment_method_state must be one of ${[...ALLOWED_PAYMENT_METHOD_STATES].join(', ')}`);
  }

  if (!ALLOWED_APPRELAY_SPEND_POLICIES.has(attachment.apprelay_spend_policy)) {
    errors.push(`sourcegrid_attachment apprelay_spend_policy must be one of ${[...ALLOWED_APPRELAY_SPEND_POLICIES].join(', ')}`);
  }

  if (!Array.isArray(attachment.command_pack_owner_repos)) {
    errors.push('sourcegrid_attachment command_pack_owner_repos must be an array');
  } else {
    for (const repoSlug of attachment.command_pack_owner_repos) {
      if (typeof repoSlug !== 'string' || repoSlug.length === 0) {
        errors.push('sourcegrid_attachment command_pack_owner_repos must contain repo slugs');
      }
    }
  }

  if (attachment.payment_method_label !== null && typeof attachment.payment_method_label !== 'string') {
    errors.push('sourcegrid_attachment payment_method_label must be null or a non-sensitive display string');
  }

  if (attachment.status === 'attached') {
    if (!attachment.sourcegrid_workspace_ref || typeof attachment.sourcegrid_workspace_ref !== 'string') {
      errors.push('sourcegrid_attachment attached status requires sourcegrid_workspace_ref');
    }

    if (!attachment.sourcegrid_account_ref || typeof attachment.sourcegrid_account_ref !== 'string') {
      errors.push('sourcegrid_attachment attached status requires sourcegrid_account_ref');
    }

    if (attachment.payment_method_state !== 'verified') {
      errors.push('sourcegrid_attachment attached status requires verified payment_method_state');
    }
  }

  return errors;
}

export function buildSourceGridAttachmentStatus(config = {}) {
  const attachment = config.sourcegrid_attachment ?? DEFAULT_SOURCEGRID_ATTACHMENT;
  const errors = validateSourceGridAttachment(attachment);
  const paymentMethodReady = attachment.payment_method_state === 'verified';
  const appRelaySpendReady =
    attachment.status === 'attached' &&
    paymentMethodReady &&
    attachment.apprelay_spend_policy === 'enabled_after_payment_verified';

  return {
    schema_version: '0.1',
    status: errors.length > 0 ? 'invalid' : attachment.status,
    sourcegrid_workspace_ref: attachment.sourcegrid_workspace_ref ?? null,
    sourcegrid_account_ref: attachment.sourcegrid_account_ref ?? null,
    billing_owner: attachment.billing_owner ?? 'sourcegrid_workspace',
    payment_method_state: attachment.payment_method_state ?? 'missing',
    payment_method_label: attachment.payment_method_label ?? null,
    apprelay_spend_policy: attachment.apprelay_spend_policy ?? 'disabled_until_payment_verified',
    apprelay_spend_ready: appRelaySpendReady,
    command_pack_owner_repos: attachment.command_pack_owner_repos ?? [],
    command_pack_repo_ready: Array.isArray(attachment.command_pack_owner_repos) && attachment.command_pack_owner_repos.length > 0,
    sourcegrid_credit_gate_scope: ['apprelay_reasoning', 'apprelay_audio', 'other_sourcegrid_billed_runtime_routes'],
    local_routes_available_without_credits: true,
    voice_capture_available_without_credits: true,
    platform_tts_available_without_credits: true,
    sourcegrid_required: true,
    local_payment_data_allowed: false,
    errors
  };
}

export function validateCommandPackRoots(commandPackRoots, { rootDir }) {
  const errors = [];

  if (commandPackRoots === undefined) {
    return errors;
  }

  if (!Array.isArray(commandPackRoots)) {
    return ['command_pack_roots must be an array'];
  }

  for (const [index, root] of commandPackRoots.entries()) {
    const prefix = `command_pack_roots[${index}]`;

    if (!root || typeof root !== 'object') {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    const forbiddenFields = findForbiddenFields(root, FORBIDDEN_DISCOVERY_ROOT_FIELDS);
    for (const field of forbiddenFields) {
      errors.push(`${prefix} includes forbidden field ${field}`);
    }

    for (const field of ['id', 'kind', 'enabled', 'discovery_mode']) {
      if (!(field in root)) {
        errors.push(`${prefix} missing field ${field}`);
      }
    }

    if (!root.id || typeof root.id !== 'string' || !/^[a-z0-9_.-]+$/.test(root.id)) {
      errors.push(`${prefix} id must be a stable lowercase identifier`);
    }

    if (!ALLOWED_DISCOVERY_ROOT_KINDS.has(root.kind)) {
      errors.push(`${prefix} kind must be one of ${[...ALLOWED_DISCOVERY_ROOT_KINDS].join(', ')}`);
    }

    if (!ALLOWED_DISCOVERY_MODES.has(root.discovery_mode)) {
      errors.push(`${prefix} discovery_mode must be metadata_only`);
    }

    if (typeof root.enabled !== 'boolean') {
      errors.push(`${prefix} enabled must be boolean`);
    }

    if (root.kind === 'owner-repo') {
      if (!root.repo_slug || typeof root.repo_slug !== 'string') {
        errors.push(`${prefix} owner-repo roots require repo_slug`);
      }

      if ('path' in root) {
        errors.push(`${prefix} owner-repo roots must not declare a local path in Phase 1`);
      }
    } else {
      if (!root.path || typeof root.path !== 'string') {
        errors.push(`${prefix} ${root.kind ?? 'root'} roots require path`);
      } else {
        validateDiscoveryRootPath(root, { rootDir, prefix, errors });
      }
    }
  }

  return errors;
}

export function buildAdapterResponseEnvelope(record, responseText, options = {}) {
  return {
    schema_version: '0.1',
    adapter: record.adapter,
    display_text: responseText,
    spoken_text: responseText,
    record_ref: record.record_id,
    permission_level: record.permission_level,
    approval_status: record.approval_status,
    route: record.route,
    response_mode: responseModeFor(options.requestedOutput),
    apprelay_audio_available: false,
    apprelay_audio_ref: null,
    reasoning_owner: 'apprelay',
    platform_reasoning_used: false,
    apple_intelligence_required: false,
    google_reasoning_required: false,
    errors: record.errors
  };
}

export function validateAdapterResponseEnvelope(envelope) {
  const errors = [];

  if (!envelope || typeof envelope !== 'object') {
    return ['adapter response envelope must be an object'];
  }

  for (const field of [
    'schema_version',
    'adapter',
    'display_text',
    'spoken_text',
    'record_ref',
    'permission_level',
    'approval_status',
    'route',
    'response_mode',
    'apprelay_audio_available',
    'errors'
  ]) {
    if (!(field in envelope)) {
      errors.push(`adapter response missing field ${field}`);
    }
  }

  if (envelope.schema_version !== '0.1') {
    errors.push('schema_version must be 0.1');
  }

  if (!['platform_tts', 'display_text', 'json'].includes(envelope.response_mode)) {
    errors.push('response_mode must be platform_tts, display_text, or json');
  }

  if (envelope.apprelay_audio_available !== false) {
    errors.push('apprelay_audio_available must remain false in Phase 1');
  }

  if (envelope.platform_reasoning_used !== false) {
    errors.push('platform_reasoning_used must remain false');
  }

  if (envelope.apple_intelligence_required !== false) {
    errors.push('apple_intelligence_required must remain false');
  }

  if (envelope.google_reasoning_required !== false) {
    errors.push('google_reasoning_required must remain false');
  }

  if (!Array.isArray(envelope.errors)) {
    errors.push('errors must be an array');
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

  for (const field of ['schema_version', 'pack_id', 'owner', 'permissions', 'record_policy', 'commands']) {
    if (!(field in pack)) {
      errors.push(`missing pack field ${field}`);
    }
  }

  if (pack.schema_version !== '0.1') {
    errors.push('schema_version must be 0.1');
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

function validateDiscoveryRootPath(root, { rootDir, prefix, errors }) {
  if (path.isAbsolute(root.path)) {
    if (root.local_only !== true) {
      errors.push(`${prefix} absolute paths require local_only true`);
    }

    return;
  }

  let resolvedPath;
  try {
    resolvedPath = resolveRepoRelativePath(rootDir, root.path);
  } catch (error) {
    errors.push(`${prefix} path ${error.message}`);
    return;
  }

  if (root.kind === 'repo-fixture') {
    const resolvedRoot = path.resolve(rootDir);
    const relative = path.relative(resolvedRoot, resolvedPath).split(path.sep).join(path.posix.sep);

    if (relative !== 'evals/fixtures/command-packs' && !relative.startsWith('evals/fixtures/command-packs/')) {
      errors.push(`${prefix} repo-fixture path must stay under evals/fixtures/command-packs`);
    }
  }

  if (root.kind === 'local-folder' && root.local_only !== true) {
    errors.push(`${prefix} local-folder roots require local_only true`);
  }
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

function approvalRequestFor(command) {
  if (command.permission_level !== 'approval-required') {
    return null;
  }

  return {
    target: command.approval_prompt.target,
    action: command.approval_prompt.action,
    risk: command.approval_prompt.risk,
    expected_record: command.approval_prompt.expected_record
  };
}

function responseFor(result, approvalStatus) {
  if (approvalStatus === 'blocked_execute_now_disabled') {
    return `${result.summary} Approval would be required in a future phase.`;
  }

  return result.summary;
}

function buildFailureRecord({ input, timestamp, commandText, command, summary }) {
  const record = {
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
    approval_request: null,
    result: {
      status: 'failed_closed',
      summary
    },
    errors: [summary],
    follow_up_owner: 'human_operator'
  };

  return buildCommandResult({
    input,
    responseText: summary,
    record
  });
}

function buildCommandResult({ input, responseText, record }) {
  return {
    response_text: responseText,
    adapter_response: buildAdapterResponseEnvelope(record, responseText, {
      requestedOutput: input.requested_output
    }),
    record
  };
}

function responseModeFor(requestedOutput) {
  if (requestedOutput === 'spoken_summary') {
    return 'platform_tts';
  }

  if (requestedOutput === 'json') {
    return 'json';
  }

  return 'display_text';
}

function stableId(prefix, parts) {
  const digest = createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
  return `${prefix}_${digest}`;
}
