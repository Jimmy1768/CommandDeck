import { createHash } from 'node:crypto';
import { access, mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWLISTED_LOCAL_RUNNER_ACTIONS, runAllowlistedLocalAction } from './local-runner.mjs';

const DEFAULT_ACTOR = 'local_prototype';
const DEFAULT_ADAPTER = 'local_cli';
const DEFAULT_WORKSPACE_REF = 'local_workspace';
const DEFAULT_CONFIG_PATH = 'commanddeck.config.json';
const COMMAND_PACK_FILE_EXTENSION = '.cdeck-pack.json';
const DEFAULT_COMMAND_PACK_PATH = 'contracts/commands/mvp-commands.cdeck-pack.json';
const DEFAULT_RECORD_DIR = 'records/actions';
const DEFAULT_PACK_STATE_PATH = '.commanddeck/state/recent-packs.json';
const DEFAULT_PACK_REJECTION_AUDIT_DIR = '.commanddeck/audit/pack-rejections';
const CUSTOM_PACK_CATALOG_DIR = 'command-packs';
const PACK_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const RECENT_PACK_LIMIT = 10;
const CCQ_TOKEN_TTL_SECONDS = 300;
const ACTION_RECORD_LOCK_STALE_MS = 30_000;
const CCQ_DUPLICATE_RESPONSE = 'That clarification is no longer active. Please give the command again.';
const SPOKEN_END_CODES = new Set(['activate']);
const SPOKEN_DEVICE_CODES = new Set(['computer', 'phone', 'watch', 'glasses']);
const DEFAULT_CORE_ACTION_REQUIREMENTS_PATH = 'contracts/commands/core-action-requirements.json';
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
const FORBIDDEN_PACK_SELECTION_FIELDS = [
  ...FORBIDDEN_DISCOVERY_ROOT_FIELDS,
  'approval',
  'approval_status',
  'execute_now'
];
const ALLOWED_DISCOVERY_ROOT_KINDS = new Set(['repo-fixture', 'owner-repo', 'local-folder']);
const ALLOWED_DISCOVERY_MODES = new Set(['metadata_only']);
const ALLOWED_PACK_SELECTION_SOURCE_KINDS = new Set(['owner-repo', 'local-folder']);
const ALLOWED_SOURCEGRID_ATTACHMENT_STATUSES = new Set(['not_attached', 'contract_only', 'attached']);
const ALLOWED_PAYMENT_METHOD_STATES = new Set(['missing', 'verified', 'not_required_contract_only']);
const ALLOWED_APPRELAY_SPEND_POLICIES = new Set([
  'disabled_until_payment_verified',
  'contract_only_no_spend',
  'enabled_after_payment_verified'
]);
const SOURCEGRID_APPRELAY_PROXY_ENDPOINT = {
  method: 'POST',
  path: '/commanddeck/apprelay/reasoning',
  owner: 'sourcegrid',
  caller: 'commanddeck',
  transport_mode: 'sourcegrid_full_proxy'
};
const SOURCEGRID_APPRELAY_PROXY_FORBIDDEN_FIELDS = [
  'model',
  'provider',
  'provider_model',
  'model_name',
  'model_key',
  'model_registry_key',
  'apprelay_api_key',
  'apprelay_token',
  'stripe_secret_key',
  'payment_card_data',
  'shell',
  'script',
  'sql',
  'approval_decision',
  'execute_now',
  'activate_memory'
];
const SOURCEGRID_APPRELAY_PROXY_ALLOWED_STATUSES = new Set([
  'ok',
  'blocked_sourcegrid_proxy_unavailable',
  'blocked_sourcegrid_scope_missing',
  'blocked_sourcegrid_scope_stale',
  'blocked_apprelay_not_entitled',
  'blocked_apprelay_spend_unavailable',
  'blocked_active_pack_scope_invalid',
  'blocked_apprelay_response_invalid',
  'blocked_rate_limited',
  'blocked_idempotency_conflict'
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
const ALLOWED_LOCAL_RUNNER_PERMISSION_LEVELS = new Set(['read-only', 'approval-required']);
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
const REQUIRED_PACK_SELECTION_FIELDS = [
  'schema_version',
  'contract_kind',
  'workspace_ref',
  'actor_ref',
  'pack_ref',
  'pack_source_kind',
  'control_root_ref',
  'pack_path',
  'selected_at'
];
const REQUIRED_ACTION_REQUIREMENT_FIELDS = [
  'action',
  'capability_source',
  'required_slots',
  'optional_slots',
  'allowed_target_kinds',
  'defaulting_rules',
  'risk_tier',
  'approval_may_be_required',
  'missing_required_slot_ccq'
];
const ALLOWED_ACTION_REQUIREMENT_SLOTS = new Set(['device_code', 'action', 'object', 'context', 'end_code']);
const ALLOWED_ACTION_REQUIREMENT_TARGET_KINDS = new Set([
  'app',
  'url',
  'dashboard',
  'repo',
  'service',
  'media',
  'device',
  'workflow',
  'data_view',
  'runtime',
  'delegate'
]);
const ALLOWED_ACTION_REQUIREMENT_RISK_TIERS = new Set([
  'informational',
  'local_control',
  'workspace_mutation',
  'delegated_agentic'
]);

export async function runLocalCommand(input, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const timestamp = options.timestamp ?? new Date().toISOString();
  const routes = await readJson(rootDir, 'contracts/routes/route-contracts.json');
  const permissions = await readJson(rootDir, 'contracts/permissions/permission-levels.json');
  const coreActionRequirements = await loadCoreActionRequirements({ rootDir });
  const pack = await loadCommandPack({
    rootDir,
    commandPackPath: options.commandPackPath,
    routes,
    permissions,
    writeAudit: options.writeAudit,
    auditDir: options.auditDir,
    timestamp
  });
  const runtimeActionRequirements = buildRuntimeActionRequirements({
    coreActionRequirements,
    pack
  });

  assertExecuteNowDisabled(permissions);

  const commandText = input.command_text ?? input.commandText ?? '';
  const command = classifyCommand(pack.commands, commandText);

  if (!command) {
    const ccq = buildMissingObjectConceptCheck({
      input,
      commandText,
      timestamp,
      actionRequirements: runtimeActionRequirements
    });

    if (ccq) {
      return ccq;
    }

    return buildFailureRecord({
      input,
      timestamp,
      commandText,
      summary: 'CommandDeck could not classify this command from the active command pack.'
    });
  }

  const route = routes.routes.find((candidate) => candidate.id === command.route);
  if (!route) {
    return buildFailureRecord({
      input,
      timestamp,
      commandText,
      command,
      summary: 'Command route is missing.'
    });
  }
  let result;

  try {
    if (isLocalExactCommand(route, command)) {
      if (command.permission_level === 'approval-required') {
        result = blockedApprovalResultFor(command);
      } else {
        result = await runAllowlistedLocalAction(command.runner_action, {
          rootDir,
          executor: options.executor
        });
      }
    } else if (route.real_integration === false) {
      const sources = await Promise.all(command.sources.map((source) => readJson(rootDir, source)));
      result = evaluateFixtureCommand(command, sources);
    } else {
      return buildFailureRecord({
        input,
        timestamp,
        commandText,
        command,
        summary: 'Command route is not available for local execution.'
      });
    }
  } catch (error) {
    return buildFailureRecord({
      input,
      timestamp,
      commandText,
      command,
      summary: `Allowlisted local runner action failed: ${error.message}`
    });
  }

  const approvalStatus = approvalStatusFor(command, route);
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
    action_key: command.runner_action ?? null,
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

export async function resumeConceptCheckingQuestion(input, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const timestamp = options.timestamp ?? new Date().toISOString();
  const recordPath = options.recordPath;
  const resumeToken = options.resumeToken ?? input.resume_token ?? input.resumeToken;
  const answerText = input.command_text ?? input.commandText ?? '';
  const record = options.record ?? (await loadActionRecord({ rootDir, recordPath }));
  const coreActionRequirements = options.coreActionRequirements ?? (await loadCoreActionRequirements({ rootDir }));
  const pack =
    options.pack ??
    (await loadCommandPack({
      rootDir,
      commandPackPath: options.commandPackPath,
      writeAudit: options.writeAudit,
      auditDir: options.auditDir,
      timestamp
    }));
  const runtimeActionRequirements = buildRuntimeActionRequirements({
    coreActionRequirements,
    pack
  });
  const terminalResult = validateAndConsumeClarification(record, {
    input,
    resumeToken,
    timestamp
  });

  if (!terminalResult.ok) {
    return {
      resume_status: terminalResult.resume_status,
      response_text: terminalResult.response_text,
      adapter_response: buildAdapterResponseEnvelope(terminalResult.record, terminalResult.response_text, {
        requestedOutput: input.requested_output
      }),
      record: terminalResult.record,
      errors: terminalResult.errors
    };
  }

  if (answerAttemptsCommandRewrite(answerText, runtimeActionRequirements)) {
    const rejectedRecord = updateClarificationStatus(record, {
      status: 'rejected',
      timestamp,
      summary: 'Clarification answer changed the unresolved command and was rejected.'
    });

    return {
      resume_status: 'rejected_rewrite',
      response_text: rejectedRecord.result.summary,
      adapter_response: buildAdapterResponseEnvelope(rejectedRecord, rejectedRecord.result.summary, {
        requestedOutput: input.requested_output
      }),
      record: rejectedRecord,
      errors: rejectedRecord.errors
    };
  }

  const mergedCommandText = mergeClarificationAnswer(record.result.clarification, answerText);
  const commandResult = await runLocalCommand(
    {
      ...input,
      command_text: mergedCommandText
    },
    {
      rootDir,
      commandPackPath: options.commandPackPath,
      executor: options.executor,
      timestamp
    }
  );

  if (isClarificationRewrite(record.result.clarification, commandResult.record)) {
    const rejectedRecord = updateClarificationStatus(record, {
      status: 'rejected',
      timestamp,
      summary: 'Clarification answer changed the unresolved command and was rejected.'
    });

    return {
      resume_status: 'rejected_rewrite',
      response_text: rejectedRecord.result.summary,
      adapter_response: buildAdapterResponseEnvelope(rejectedRecord, rejectedRecord.result.summary, {
        requestedOutput: input.requested_output
      }),
      record: rejectedRecord,
      errors: rejectedRecord.errors
    };
  }

  const consumedRecord = updateClarificationStatus(record, {
    status: 'used',
    timestamp,
    summary: 'Clarification token was consumed by a resumed command.'
  });

  return {
    resume_status: 'resumed',
    response_text: commandResult.response_text,
    adapter_response: commandResult.adapter_response,
    record: commandResult.record,
    ccq_record: consumedRecord,
    errors: []
  };
}

export async function resumeConceptCheckingQuestionFromFile(input, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const recordPath = options.recordPath;

  if (!recordPath) {
    throw new Error('recordPath is required');
  }

  if (!options.writeRecord) {
    return resumeConceptCheckingQuestion(input, {
      ...options,
      rootDir,
      recordPath
    });
  }

  return withActionRecordLock(rootDir, recordPath, async () => {
    const resumeResult = await resumeConceptCheckingQuestion(input, {
      ...options,
      rootDir,
      recordPath
    });

    if (resumeResult.ccq_record) {
      resumeResult.ccq_record_write = await writeActionRecordFile(resumeResult.ccq_record, {
        rootDir,
        recordPath,
        overwrite: true
      });
      resumeResult.record_write = await writeActionRecord(resumeResult.record, {
        rootDir,
        recordDir: options.recordDir ?? DEFAULT_RECORD_DIR
      });
    } else {
      resumeResult.record_write = await writeActionRecordFile(resumeResult.record, {
        rootDir,
        recordPath,
        overwrite: true
      });
    }

    return resumeResult;
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

  return loadValidatedCommandPack({
    rootDir,
    commandPackPath,
    routes,
    permissions,
    writeAudit: options.writeAudit,
    auditDir: options.auditDir,
    timestamp: options.timestamp
  });
}

export async function openCommandPack(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const timestamp = options.timestamp ?? new Date().toISOString();
  const commandPackPath = options.commandPackPath;
  const resolvedCommandPackPath = options.resolvedCommandPackPath;

  if (!commandPackPath) {
    throw new Error('commandPackPath is required');
  }

  const pack = await loadValidatedCommandPack({
    rootDir,
    commandPackPath,
    resolvedCommandPackPath,
    routes: options.routes,
    permissions: options.permissions,
    writeAudit: options.writeAudit,
    auditDir: options.auditDir,
    timestamp
  });
  const entry = {
    pack_id: pack.pack_id,
    owner: pack.owner,
    command_pack_path: commandPackPath,
    resolved_command_pack_path: resolvedCommandPackPath ?? null,
    opened_at: timestamp,
    command_count: pack.commands.length,
    action_requirement_count: pack.action_requirements?.length ?? 0
  };
  const result = {
    schema_version: '0.1',
    status: 'opened',
    active_pack_policy: 'single_active_pack_per_invocation',
    active_command_pack: commandPackPath,
    resolved_command_pack_path: resolvedCommandPackPath ?? null,
    pack,
    recent_entry: entry
  };

  if (options.writeState) {
    result.recent_write = await writeRecentCommandPack(entry, {
      rootDir,
      statePath: options.statePath
    });
  } else {
    result.recent_write = {
      status: 'not_written',
      reason: 'recent pack persistence requires --write-state'
    };
  }

  return result;
}

export async function initCommandPack(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const controlRoot = options.controlRoot ?? '.';
  const packSlug = options.packSlug;
  const owner = options.owner;

  if (!packSlug) {
    throw new Error('packSlug is required');
  }

  if (!owner) {
    throw new Error('owner is required');
  }

  if (!PACK_SLUG_PATTERN.test(packSlug)) {
    throw new Error('packSlug must be lowercase kebab-case');
  }

  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(owner)) {
    throw new Error('owner must be a stable lowercase identifier');
  }

  const resolvedControlRoot = resolvePackInitControlRoot(rootDir, controlRoot);
  const packDir = path.join(resolvedControlRoot, CUSTOM_PACK_CATALOG_DIR, packSlug);
  const manifestPath = path.join(packDir, `${packSlug}${COMMAND_PACK_FILE_EXTENSION}`);
  const readmePath = path.join(packDir, 'README.md');
  const fixturesDir = path.join(packDir, 'fixtures');
  const scriptsDir = path.join(packDir, 'scripts');

  for (const targetPath of [manifestPath, readmePath]) {
    if (await pathExists(targetPath)) {
      throw new Error(`pack:init refuses to overwrite existing file: ${targetPath}`);
    }
  }

  await mkdir(fixturesDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(buildStarterCommandPack({ packSlug, owner }), null, 2)}\n`, {
    flag: 'wx'
  });
  await writeFile(readmePath, buildStarterCommandPackReadme({ packSlug, owner }), { flag: 'wx' });

  return {
    schema_version: '0.1',
    status: 'initialized',
    pack_slug: packSlug,
    owner,
    control_root: resolvedControlRoot,
    pack_dir: packDir,
    manifest_path: manifestPath,
    selector_pack_path: `${CUSTOM_PACK_CATALOG_DIR}/${packSlug}/${packSlug}${COMMAND_PACK_FILE_EXTENSION}`,
    created: {
      manifest: manifestPath,
      readme: readmePath,
      fixtures_dir: fixturesDir,
      scripts_dir: scriptsDir
    },
    execution_enabled: false,
    overwrite_allowed: false
  };
}

export async function loadRecentCommandPacks(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const statePath = options.statePath ?? DEFAULT_PACK_STATE_PATH;

  if (!(await pathExists(resolveRepoRelativePath(rootDir, statePath)))) {
    return {
      schema_version: '0.1',
      state_path: statePath,
      active_pack_policy: 'single_active_pack_per_invocation',
      recent_packs: []
    };
  }

  const state = await readRepoRelativeJson(rootDir, statePath);
  const recentPacks = Array.isArray(state.recent_packs) ? state.recent_packs : [];

  return {
    schema_version: '0.1',
    state_path: statePath,
    active_pack_policy: 'single_active_pack_per_invocation',
    recent_packs: recentPacks.slice(0, RECENT_PACK_LIMIT)
  };
}

export async function writeRecentCommandPack(entry, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const statePath = options.statePath ?? DEFAULT_PACK_STATE_PATH;
  const current = await loadRecentCommandPacks({ rootDir, statePath });
  const recentPacks = [
    entry,
    ...current.recent_packs.filter((recent) => recent.command_pack_path !== entry.command_pack_path)
  ].slice(0, RECENT_PACK_LIMIT);
  const state = {
    schema_version: '0.1',
    active_pack_policy: 'single_active_pack_per_invocation',
    recent_packs: recentPacks
  };
  const resolvedPath = resolveRepoRelativePath(rootDir, statePath);

  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(state, null, 2)}\n`, { flag: 'w' });

  return {
    status: 'written',
    state_path: statePath,
    recent_count: recentPacks.length
  };
}

export async function loadSourceGridPackSelection(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const selectionPath = options.selectionPath;

  if (!selectionPath) {
    throw new Error('selectionPath is required');
  }

  const selection = await readRepoRelativeJson(rootDir, selectionPath);
  const errors = validateSourceGridPackSelection(selection);

  if (errors.length > 0) {
    throw new Error(`invalid SourceGrid pack selection ${selectionPath}: ${errors.join('; ')}`);
  }

  return selection;
}

export async function applySourceGridPackSelection(selection, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const config = options.config ?? (await loadCommandDeckConfig({ rootDir, configPath: options.configPath }));
  const errors = validateSourceGridPackSelection(selection);

  if (errors.length > 0) {
    throw new Error(`invalid SourceGrid pack selection: ${errors.join('; ')}`);
  }

  const selectedPack = resolveSelectionCommandPackPath(rootDir, config, selection);
  const opened = await openCommandPack({
    rootDir,
    commandPackPath: selectedPack.commandPackPath,
    resolvedCommandPackPath: selectedPack.resolvedCommandPackPath,
    writeState: options.writeState,
    statePath: options.statePath,
    timestamp: options.timestamp,
    writeAudit: options.writeAudit,
    auditDir: options.auditDir
  });

  return {
    schema_version: '0.1',
    status: 'applied',
    bridge_mode: 'pull_then_local_validate',
    selection_apply_rule: 'sourcegrid_selection_is_candidate_until_local_pack_open_validates_one_pack',
    workspace_ref: selection.workspace_ref,
    actor_ref: selection.actor_ref,
    pack_ref: selection.pack_ref,
    control_root_ref: selection.control_root_ref,
    active_command_pack: selectedPack.commandPackPath,
    resolved_command_pack_path: selectedPack.resolvedCommandPackPath,
    opened_pack: opened
  };
}

export function validateSourceGridPackSelection(selection) {
  const errors = [];

  if (!selection || typeof selection !== 'object') {
    return ['selection must be an object'];
  }

  const forbiddenFields = findForbiddenFields(selection, FORBIDDEN_PACK_SELECTION_FIELDS);
  for (const field of forbiddenFields) {
    errors.push(`selection includes forbidden field ${field}`);
  }

  for (const field of REQUIRED_PACK_SELECTION_FIELDS) {
    if (!(field in selection)) {
      errors.push(`selection missing field ${field}`);
    }
  }

  if (selection.schema_version !== '0.1') {
    errors.push('selection schema_version must be 0.1');
  }

  if (selection.contract_kind !== 'sourcegrid-pack-selection') {
    errors.push('selection contract_kind must be sourcegrid-pack-selection');
  }

  for (const field of ['workspace_ref', 'actor_ref', 'pack_ref', 'control_root_ref', 'pack_path', 'selected_at']) {
    if (field in selection && (!selection[field] || typeof selection[field] !== 'string')) {
      errors.push(`selection ${field} must be a string`);
    }
  }

  if ('pack_path' in selection && typeof selection.pack_path === 'string' && !isCommandPackManifestPath(selection.pack_path)) {
    errors.push(`selection pack_path must end with ${COMMAND_PACK_FILE_EXTENSION}`);
  }

  if (!ALLOWED_PACK_SELECTION_SOURCE_KINDS.has(selection.pack_source_kind)) {
    errors.push(`selection pack_source_kind must be one of ${[...ALLOWED_PACK_SELECTION_SOURCE_KINDS].join(', ')}`);
  }

  return errors;
}

function resolveSelectionCommandPackPath(rootDir, config, selection) {
  const roots = config.command_pack_roots ?? [];
  const controlRoot = roots.find((root) => root.id === selection.control_root_ref);

  if (!controlRoot) {
    throw new Error(`selection control_root_ref is not configured: ${selection.control_root_ref}`);
  }

  if (controlRoot.enabled !== true) {
    throw new Error(`selection control root is not enabled: ${selection.control_root_ref}`);
  }

  if (controlRoot.kind !== selection.pack_source_kind) {
    throw new Error(`selection pack_source_kind does not match configured control root: ${selection.control_root_ref}`);
  }

  if (!controlRoot.path || typeof controlRoot.path !== 'string') {
    throw new Error(`selection control root has no local path: ${selection.control_root_ref}`);
  }

  if (path.isAbsolute(controlRoot.path) && controlRoot.local_only !== true) {
    throw new Error('absolute control root pack application requires local_only true');
  }

  if (path.isAbsolute(controlRoot.path) && controlRoot.kind !== 'local-folder') {
    throw new Error('absolute control root pack application is only allowed for local-folder roots');
  }

  if (path.isAbsolute(selection.pack_path)) {
    throw new Error('selection pack_path must be relative to the control root');
  }

  assertCommandPackManifestPath(selection.pack_path);

  if (path.isAbsolute(controlRoot.path)) {
    assertCustomPackCatalogPath(selection.pack_path);
  }

  const resolvedRoot = path.isAbsolute(controlRoot.path)
    ? path.resolve(controlRoot.path)
    : resolveRepoRelativePath(rootDir, controlRoot.path);
  const resolvedPack = path.resolve(resolvedRoot, selection.pack_path);
  const relativeToControlRoot = path.relative(resolvedRoot, resolvedPack);

  if (relativeToControlRoot.startsWith('..') || path.isAbsolute(relativeToControlRoot)) {
    throw new Error('selection pack_path must stay inside the configured control root');
  }

  const relativeToRepo = path.relative(path.resolve(rootDir), resolvedPack);
  if (relativeToRepo.startsWith('..') || path.isAbsolute(relativeToRepo)) {
    return {
      commandPackPath: `control-root:${selection.control_root_ref}/${selection.pack_path}`,
      resolvedCommandPackPath: resolvedPack
    };
  }

  return {
    commandPackPath: relativeToRepo.split(path.sep).join(path.posix.sep),
    resolvedCommandPackPath: resolvedPack
  };
}

export async function loadCoreActionRequirements(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const requirementsPath = options.requirementsPath ?? DEFAULT_CORE_ACTION_REQUIREMENTS_PATH;
  const requirements = await readRepoRelativeJson(rootDir, requirementsPath);
  const errors = validateCoreActionRequirements(requirements);

  if (errors.length > 0) {
    throw new Error(`invalid core action requirements ${requirementsPath}: ${errors.join('; ')}`);
  }

  return new Map(requirements.actions.map((action) => [action.action, action]));
}

export function buildRuntimeActionRequirements({ coreActionRequirements, pack }) {
  const requirements = new Map(coreActionRequirements);

  for (const actionRequirement of pack?.action_requirements ?? []) {
    if (actionRequirement.capability_source !== 'pack') {
      continue;
    }

    if (!requirements.has(actionRequirement.action)) {
      requirements.set(actionRequirement.action, actionRequirement);
    }
  }

  return requirements;
}

export function validateCoreActionRequirements(requirements) {
  const errors = [];
  const seenActions = new Set();

  if (!requirements || typeof requirements !== 'object') {
    return ['core action requirements must be an object'];
  }

  if (requirements.contract_kind !== 'action-requirements') {
    errors.push('contract_kind must be action-requirements');
  }

  if (requirements.owner !== 'command-deck') {
    errors.push('owner must be command-deck');
  }

  if (!Array.isArray(requirements.actions) || requirements.actions.length === 0) {
    errors.push('actions must be a non-empty array');
    return errors;
  }

  for (const action of requirements.actions) {
    if (!action || typeof action !== 'object') {
      errors.push('action requirement must be an object');
      continue;
    }

    errors.push(...validateActionRequirementShape(action, { expectedCapabilitySource: 'core', seenActions }));
  }

  return errors;
}

function validatePackActionRequirements(actionRequirements) {
  const errors = [];
  const seenActions = new Set();

  if (actionRequirements === undefined) {
    return errors;
  }

  if (!Array.isArray(actionRequirements)) {
    return ['action_requirements must be an array'];
  }

  for (const action of actionRequirements) {
    if (!action || typeof action !== 'object') {
      errors.push('action requirement must be an object');
      continue;
    }

    errors.push(...validateActionRequirementShape(action, { expectedCapabilitySource: 'pack', seenActions }));
  }

  return errors;
}

function validateActionRequirementShape(action, { expectedCapabilitySource, seenActions }) {
  const errors = [];

  for (const field of REQUIRED_ACTION_REQUIREMENT_FIELDS) {
    if (!(field in action)) {
      errors.push(`${action.action ?? '<unknown>'} missing action requirement field ${field}`);
    }
  }

  if (!action.action || typeof action.action !== 'string') {
    errors.push('action requirement action must be a string');
  } else if (seenActions.has(action.action)) {
    errors.push(`${action.action} action requirement must be unique`);
  } else {
    seenActions.add(action.action);
  }

  if (action.capability_source !== expectedCapabilitySource) {
    errors.push(`${action.action ?? '<unknown>'} capability_source must be ${expectedCapabilitySource}`);
  }

  if (!Array.isArray(action.required_slots) || !action.required_slots.includes('object')) {
    errors.push(`${action.action ?? '<unknown>'} required_slots must include object`);
  } else {
    for (const slot of action.required_slots) {
      if (!ALLOWED_ACTION_REQUIREMENT_SLOTS.has(slot)) {
        errors.push(`${action.action ?? '<unknown>'} required_slots includes unsupported slot ${slot}`);
      }
    }
  }

  if (!Array.isArray(action.optional_slots)) {
    errors.push(`${action.action ?? '<unknown>'} optional_slots must be an array`);
  } else {
    for (const slot of action.optional_slots) {
      if (!ALLOWED_ACTION_REQUIREMENT_SLOTS.has(slot)) {
        errors.push(`${action.action ?? '<unknown>'} optional_slots includes unsupported slot ${slot}`);
      }
    }
  }

  if (!Array.isArray(action.allowed_target_kinds) || action.allowed_target_kinds.length === 0) {
    errors.push(`${action.action ?? '<unknown>'} allowed_target_kinds must be a non-empty array`);
  } else {
    for (const targetKind of action.allowed_target_kinds) {
      if (!ALLOWED_ACTION_REQUIREMENT_TARGET_KINDS.has(targetKind)) {
        errors.push(`${action.action ?? '<unknown>'} allowed_target_kinds includes unsupported target ${targetKind}`);
      }
    }
  }

  if (!Array.isArray(action.defaulting_rules)) {
    errors.push(`${action.action ?? '<unknown>'} defaulting_rules must be an array`);
  }

  if (action.conditionally_required_slots !== undefined && !Array.isArray(action.conditionally_required_slots)) {
    errors.push(`${action.action ?? '<unknown>'} conditionally_required_slots must be an array`);
  }

  if (!ALLOWED_ACTION_REQUIREMENT_RISK_TIERS.has(action.risk_tier)) {
    errors.push(`${action.action ?? '<unknown>'} risk_tier is unsupported`);
  }

  if (typeof action.approval_may_be_required !== 'boolean') {
    errors.push(`${action.action ?? '<unknown>'} approval_may_be_required must be a boolean`);
  }

  if (!action.missing_required_slot_ccq || typeof action.missing_required_slot_ccq !== 'string') {
    errors.push(`${action.action ?? '<unknown>'} missing_required_slot_ccq must be a string`);
  }

  return errors;
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

export async function loadActionRecord(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const recordPath = options.recordPath;

  if (!recordPath) {
    throw new Error('recordPath is required');
  }

  return readRepoRelativeJson(rootDir, recordPath);
}

export async function loadApprovalDecision(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const decisionPath = options.decisionPath;

  if (!decisionPath) {
    throw new Error('decisionPath is required');
  }

  return readRepoRelativeJson(rootDir, decisionPath);
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
    const decisionResult = await applyApprovalDecision(record, decision, {
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

export async function applyApprovalDecision(record, decision, options = {}) {
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
      record: {
        ...record,
        approval_status: 'denied',
        follow_up_owner: 'human_operator'
      },
      errors: []
    };
  }

  if (options.executeApprovedLocalActions) {
    const execution = await executeApprovedLocalAction(record, {
      rootDir: options.rootDir,
      executor: options.executor,
      routes: options.routes
    });

    if (execution.executed) {
      return {
        decision_id: decision.decision_id,
        record_id: record.record_id,
        decision_status: 'approved_executed_local_action',
        approval_status: 'approved',
        result: execution.record.result,
        record: execution.record,
        errors: []
      };
    }
  }

  return {
    decision_id: decision.decision_id,
    record_id: record.record_id,
    decision_status: 'approved_execution_disabled',
    approval_status: 'approved',
    result: record.result,
    record: {
      ...record,
      approval_status: 'approved'
    },
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

export function buildActiveCommandPackStatus(config = {}) {
  const commandPackRoots = Array.isArray(config.command_pack_roots) ? config.command_pack_roots : [];

  return {
    schema_version: '0.1',
    active_command_pack: config.default_command_pack ?? DEFAULT_COMMAND_PACK_PATH,
    active_pack_source_field: 'default_command_pack',
    active_pack_policy: 'single_active_pack_per_invocation',
    discovery_roots_configured: commandPackRoots.length,
    discovery_roots_active_for_routing: false,
    discovery_roots_role: 'available_pack_locations_only'
  };
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

  const defaultCommandPack = config.default_command_pack ?? DEFAULT_COMMAND_PACK_PATH;

  if (!isCommandPackManifestPath(defaultCommandPack)) {
    errors.push(`default_command_pack must end with ${COMMAND_PACK_FILE_EXTENSION}`);
  }

  try {
    resolveRepoRelativePath(rootDir, defaultCommandPack);
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

export function buildSourceGridAppRelayProxyRequest(input = {}, options = {}) {
  const config = options.config ?? DEFAULT_CONFIG;
  const attachment = config.sourcegrid_attachment ?? DEFAULT_SOURCEGRID_ATTACHMENT;
  const activePack = options.activePack ?? buildActiveCommandPackStatus(config);
  const timestamp = options.timestamp ?? new Date().toISOString();
  const commandText = input.command_text ?? input.commandText ?? '';
  const requestId = options.requestId ?? stableId('sgarp_req', [input.actor_ref ?? DEFAULT_ACTOR, commandText, timestamp]);
  const idempotencyKey = options.idempotencyKey ?? stableId('sgarp_idem', [requestId]);
  const request = {
    schema_version: '0.1',
    request_identity: {
      client_key: 'commanddeck',
      client_type: 'internal_ops_tool',
      runtime_mode: 'sourcegrid_internal_ops',
      purpose: 'command_routing_reasoning',
      request_id: requestId,
      idempotency_key: idempotencyKey
    },
    sourcegrid_attachment_ref: {
      sourcegrid_workspace_ref: attachment.sourcegrid_workspace_ref ?? null,
      sourcegrid_account_ref: attachment.sourcegrid_account_ref ?? null,
      sourcegrid_user_ref: options.sourcegridUserRef ?? input.actor_ref ?? DEFAULT_ACTOR
    },
    active_local_context: {
      active_pack_ref: activePack.active_command_pack ?? DEFAULT_COMMAND_PACK_PATH,
      active_pack_digest: options.activePackDigest ?? null,
      control_folder_ref: options.controlFolderRef ?? activePack.active_pack_source_field ?? 'default_command_pack',
      control_folder_digest: options.controlFolderDigest ?? null,
      adapter: input.adapter ?? DEFAULT_ADAPTER,
      surface_hint: input.surface_hint ?? null,
      device_code: input.device_code ?? null,
      commanddeck_version: options.commandDeckVersion ?? '0.0.0'
    },
    authority_constraints: {
      no_execution_authority: true,
      no_memory_activation: true,
      memory_read_scope: 'approved_active_only',
      memory_writeback_policy: 'candidate_only_requires_explicit_user_confirmation'
    },
    runtime_task: {
      route_work_type: 'commanddeck.command_routing_reasoning.standard',
      reasoning_task: options.reasoningTask ?? 'intent_resolution',
      escalation_reason: options.escalationReason ?? 'fast_lane_failed',
      latency_class: options.latencyClass ?? 'interactive',
      risk_tier: options.riskTier ?? 'command_routing',
      sensitivity: options.sensitivity ?? 'workspace_metadata',
      cost_class: options.costClass ?? 'sourcegrid_billed_runtime',
      constraints: options.constraints ?? [
        'return_concept_checking_question_when_uncertain',
        'do_not_return_execution_payloads'
      ],
      task_metadata: options.taskMetadata ?? {
        active_route_family: 'apprelay.reasoning'
      }
    },
    required_output_schema: 'contracts/apprelay/commanddeck-reasoning-response.schema.json',
    user_utterance: commandText
  };

  return {
    schema_version: '0.1',
    contract_kind: 'commanddeck-sourcegrid-apprelay-proxy-client-preview',
    endpoint: SOURCEGRID_APPRELAY_PROXY_ENDPOINT,
    network_call_status: 'not_sent_contract_only',
    sourcegrid_contract_status: 'accepted_contract_only',
    request,
    validation: {
      errors: validateSourceGridAppRelayProxyRequest(request)
    }
  };
}

export function validateSourceGridAppRelayProxyRequest(request) {
  const errors = [];

  if (!request || typeof request !== 'object') {
    return ['request must be an object'];
  }

  const forbiddenFields = findForbiddenFields(request, SOURCEGRID_APPRELAY_PROXY_FORBIDDEN_FIELDS);
  for (const field of forbiddenFields) {
    errors.push(`sourcegrid apprelay proxy request includes forbidden field ${field}`);
  }

  for (const field of [
    'schema_version',
    'request_identity',
    'sourcegrid_attachment_ref',
    'active_local_context',
    'authority_constraints',
    'runtime_task',
    'required_output_schema',
    'user_utterance'
  ]) {
    if (!(field in request)) {
      errors.push(`sourcegrid apprelay proxy request missing field ${field}`);
    }
  }

  if (request.schema_version !== '0.1') {
    errors.push('sourcegrid apprelay proxy request schema_version must be 0.1');
  }

  const identity = request.request_identity ?? {};
  const requiredIdentity = {
    client_key: 'commanddeck',
    client_type: 'internal_ops_tool',
    runtime_mode: 'sourcegrid_internal_ops',
    purpose: 'command_routing_reasoning'
  };

  for (const [field, value] of Object.entries(requiredIdentity)) {
    if (identity[field] !== value) {
      errors.push(`sourcegrid apprelay proxy request request_identity.${field} must be ${value}`);
    }
  }

  for (const field of ['request_id', 'idempotency_key']) {
    if (!identity[field] || typeof identity[field] !== 'string') {
      errors.push(`sourcegrid apprelay proxy request request_identity.${field} is required`);
    }
  }

  const attachmentRef = request.sourcegrid_attachment_ref ?? {};
  for (const field of ['sourcegrid_workspace_ref', 'sourcegrid_account_ref', 'sourcegrid_user_ref']) {
    if (!attachmentRef[field] || typeof attachmentRef[field] !== 'string') {
      errors.push(`sourcegrid apprelay proxy request sourcegrid_attachment_ref.${field} is required`);
    }
  }

  const authority = request.authority_constraints ?? {};
  if (authority.no_execution_authority !== true) {
    errors.push('sourcegrid apprelay proxy request must set no_execution_authority true');
  }

  if (authority.no_memory_activation !== true) {
    errors.push('sourcegrid apprelay proxy request must set no_memory_activation true');
  }

  if (authority.memory_read_scope !== 'approved_active_only') {
    errors.push('sourcegrid apprelay proxy request memory_read_scope must be approved_active_only');
  }

  if (authority.memory_writeback_policy !== 'candidate_only_requires_explicit_user_confirmation') {
    errors.push('sourcegrid apprelay proxy request memory_writeback_policy must require explicit user confirmation');
  }

  if (request.runtime_task?.route_work_type !== 'commanddeck.command_routing_reasoning.standard') {
    errors.push('sourcegrid apprelay proxy request route_work_type must be commanddeck.command_routing_reasoning.standard');
  }

  if (request.required_output_schema !== 'contracts/apprelay/commanddeck-reasoning-response.schema.json') {
    errors.push('sourcegrid apprelay proxy request required_output_schema must be the CommandDeck AppRelay response contract');
  }

  return errors;
}

export function buildCommandDeckResponseForSourceGridProxyResponse(response) {
  const errors = validateSourceGridAppRelayProxyResponse(response);

  if (errors.length > 0) {
    return {
      status: 'blocked_apprelay_response_invalid',
      response_text: 'SourceGrid returned an invalid AppRelay reasoning response, so CommandDeck failed closed.',
      retryable: false,
      errors
    };
  }

  if (response.status === 'ok') {
    return {
      status: 'ok',
      response_text: 'SourceGrid returned AppRelay reasoning. CommandDeck must validate and revalidate before routing.',
      retryable: false,
      apprelay_response: response.apprelay_response,
      errors: []
    };
  }

  return {
    status: response.status,
    response_text: response.user_message,
    retryable: response.retryable,
    errors: []
  };
}

export function validateSourceGridAppRelayProxyResponse(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    return ['sourcegrid apprelay proxy response must be an object'];
  }

  if (response.schema_version !== '0.1') {
    errors.push('sourcegrid apprelay proxy response schema_version must be 0.1');
  }

  if (!SOURCEGRID_APPRELAY_PROXY_ALLOWED_STATUSES.has(response.status)) {
    errors.push(`sourcegrid apprelay proxy response status must be one of ${[...SOURCEGRID_APPRELAY_PROXY_ALLOWED_STATUSES].join(', ')}`);
  }

  if (!response.request_id || typeof response.request_id !== 'string') {
    errors.push('sourcegrid apprelay proxy response request_id is required');
  }

  if (response.status === 'ok') {
    if (!response.sourcegrid_proxy_ref || typeof response.sourcegrid_proxy_ref !== 'string') {
      errors.push('sourcegrid apprelay proxy ok response requires sourcegrid_proxy_ref');
    }

    if (!response.apprelay_response || typeof response.apprelay_response !== 'object') {
      errors.push('sourcegrid apprelay proxy ok response requires apprelay_response');
    }
  } else {
    for (const field of ['reason', 'user_message']) {
      if (!response[field] || typeof response[field] !== 'string') {
        errors.push(`sourcegrid apprelay proxy blocked response requires ${field}`);
      }
    }

    if (typeof response.retryable !== 'boolean') {
      errors.push('sourcegrid apprelay proxy blocked response requires boolean retryable');
    }
  }

  return errors;
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

  errors.push(...validatePackActionRequirements(pack.action_requirements));

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

    if ('runner_action' in command && typeof command.runner_action !== 'string') {
      errors.push(`${commandId} runner_action must be a string`);
    }

    if (!allowedPermissionLevels.has(command.permission_level)) {
      errors.push(`${commandId} has unsupported permission level ${command.permission_level}`);
    }

    const route = routeById.get(command.route);
    if (!route) {
      errors.push(`${commandId} references unknown route ${command.route}`);
    } else {
      if (!route.allowed_permission_levels.includes(command.permission_level)) {
        errors.push(`${commandId} permission ${command.permission_level} is not allowed by route ${command.route}`);
      }

      if (route.real_integration !== false && !isLocalExactCommand(route, command)) {
        errors.push(`${commandId} route ${command.route} is not an allowed local exact runner route`);
      }

      if (route.real_integration === false && 'runner_action' in command) {
        errors.push(`${commandId} runner_action requires a local exact runner route`);
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
        if (command.runner_action) {
          if (!isSafeLocalSource(source)) {
            errors.push(`${commandId} runner_action sources must use local:// descriptors: ${source}`);
          }
        } else if (!isSafeFixtureSource(source)) {
          errors.push(`${commandId} source must be repo-relative under evals/fixtures: ${source}`);
        }
      }
    }

    if (command.runner_action) {
      if (!ALLOWED_LOCAL_RUNNER_PERMISSION_LEVELS.has(command.permission_level)) {
        errors.push(`${commandId} runner_action commands must remain read-only or approval-required in this slice`);
      }

      if (!ALLOWLISTED_LOCAL_RUNNER_ACTIONS.includes(command.runner_action)) {
        errors.push(`${commandId} runner_action is not allowlisted by the shell core: ${command.runner_action}`);
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
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, { flag: options.overwrite ? 'w' : 'wx' });

  return {
    record_path: path.relative(rootDir, recordPath)
  };
}

export async function writeActionRecordFile(record, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const recordPath = options.recordPath;

  if (!recordPath) {
    throw new Error('recordPath is required');
  }

  const resolvedPath = resolveRepoRelativePath(rootDir, recordPath);
  await writeFile(resolvedPath, `${JSON.stringify(record, null, 2)}\n`, { flag: options.overwrite ? 'w' : 'wx' });

  return {
    record_path: path.relative(rootDir, resolvedPath)
  };
}

export async function writePackRejectionAudit(event, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const auditDir = resolveRecordDir(rootDir, options.auditDir ?? DEFAULT_PACK_REJECTION_AUDIT_DIR);
  const timestamp = event.timestamp ?? new Date().toISOString();
  const eventId =
    event.event_id ?? stableId('pkr', [timestamp, event.event, event.command_pack_path, JSON.stringify(event.errors ?? [])]);
  const filename = `${sanitizeFilenamePart(timestamp)}-${sanitizeFilenamePart(
    event.pack_id ?? 'unknown-pack'
  )}-${eventId}.json`;
  const auditPath = path.join(auditDir, filename);
  const auditEvent = {
    ...event,
    event_id: eventId,
    timestamp
  };

  await mkdir(auditDir, { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(auditEvent, null, 2)}\n`, { flag: 'wx' });

  return {
    status: 'written',
    audit_path: path.relative(rootDir, auditPath)
  };
}

export async function withActionRecordLock(rootDir, recordPath, callback) {
  const resolvedPath = resolveRepoRelativePath(rootDir, recordPath);
  const lockPath = `${resolvedPath}.lock`;
  const lock = await acquireActionRecordLock(lockPath);

  try {
    return await callback();
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

async function acquireActionRecordLock(lockPath) {
  try {
    return await open(lockPath, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }

    if (await removeStaleActionRecordLock(lockPath)) {
      return open(lockPath, 'wx');
    }

    throw new Error('action record is locked by another CommandDeck process');
  }
}

async function removeStaleActionRecordLock(lockPath) {
  let lockStat;
  try {
    lockStat = await stat(lockPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true;
    }

    throw error;
  }

  if (Date.now() - lockStat.mtimeMs <= ACTION_RECORD_LOCK_STALE_MS) {
    return false;
  }

  try {
    await unlink(lockPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true;
    }

    throw error;
  }
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

async function loadValidatedCommandPack({
  rootDir,
  commandPackPath,
  resolvedCommandPackPath,
  routes,
  permissions,
  writeAudit,
  auditDir,
  timestamp
}) {
  assertCommandPackManifestPath(commandPackPath);

  if (resolvedCommandPackPath) {
    if (!path.isAbsolute(resolvedCommandPackPath)) {
      throw new Error('resolved command pack path must be absolute');
    }

    assertCommandPackManifestPath(resolvedCommandPackPath);
  }

  const routeContracts = routes ?? (await readJson(rootDir, 'contracts/routes/route-contracts.json'));
  const permissionContracts = permissions ?? (await readJson(rootDir, 'contracts/permissions/permission-levels.json'));
  const pack = resolvedCommandPackPath
    ? JSON.parse(await readFile(resolvedCommandPackPath, 'utf8'))
    : await readRepoRelativeJson(rootDir, commandPackPath);
  const errors = validateCommandPack(pack, { routes: routeContracts, permissions: permissionContracts });

  if (errors.length > 0) {
    let auditWrite = null;

    if (writeAudit) {
      auditWrite = await writePackRejectionAudit(
        buildPackRejectionAuditEvent({
          pack,
          commandPackPath,
          resolvedCommandPackPath,
          errors,
          timestamp
        }),
        {
          rootDir,
          auditDir
        }
      );
    }

    const auditSuffix = auditWrite ? `; audit written to ${auditWrite.audit_path}` : '';
    throw new Error(`invalid command pack ${commandPackPath}: ${errors.join('; ')}${auditSuffix}`);
  }

  return pack;
}

function buildPackRejectionAuditEvent({ pack, commandPackPath, resolvedCommandPackPath, errors, timestamp }) {
  const sanitizedErrors = errors.map((error) => sanitizeAuditText(error));
  const commandIds = Array.isArray(pack?.commands)
    ? pack.commands
        .map((command) => command?.command_id)
        .filter((commandId) => typeof commandId === 'string' && commandId.length > 0)
    : [];
  const packId = typeof pack?.pack_id === 'string' ? pack.pack_id : null;
  const eventId = stableId('pkr', [
    timestamp ?? '',
    commandPackPath ?? '',
    resolvedCommandPackPath ?? '',
    packId ?? '',
    sanitizedErrors.join('|')
  ]);

  return {
    schema_version: '0.1',
    event: 'pack_command_rejected',
    event_id: eventId,
    timestamp: timestamp ?? new Date().toISOString(),
    status: 'rejected',
    rejection_phase: 'pack_load',
    reason: 'invalid_command_pack',
    command_pack_path: commandPackPath,
    resolved_command_pack_path: resolvedCommandPackPath ?? null,
    pack_id: packId,
    owner: typeof pack?.owner === 'string' ? pack.owner : null,
    command_ids: commandIds,
    errors: sanitizedErrors,
    redaction_policy: 'secret_like_values_redacted_no_script_contents_stored'
  };
}

function sanitizeAuditText(value) {
  return String(value)
    .replace(
      /\b(token|secret|password|authorization|api[_-]?key|cvv|cvc|payment[_-]?token)=([^&\s;]+)/gi,
      '$1=[REDACTED]'
    )
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]');
}

function sanitizeFilenamePart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildStarterCommandPack({ packSlug, owner }) {
  return {
    schema_version: '0.1',
    pack_id: `${owner}.${packSlug}`,
    owner,
    permissions: 'contracts/permissions/permission-levels.json',
    record_policy: {
      record_schema: 'contracts/records/action-record.schema.json',
      storage: 'local_action_record'
    },
    commands: [
      {
        command_id: `${packSlug}.starter_status`,
        title: `Describe the ${packSlug} command pack.`,
        example_utterances: [`Describe the ${packSlug} command pack.`],
        permission_level: 'read-only',
        route: 'local.fixture_read',
        allowed_effects: ['read_local_fixture'],
        forbidden_effects: ['state_change', 'external_call', 'execute_now'],
        sources: ['evals/fixtures/generic/current_repo_summary.json']
      }
    ]
  };
}

function buildStarterCommandPackReadme({ packSlug, owner }) {
  return `# ${packSlug} CommandDeck Pack

Owner: ${owner}

This pack was created by \`pack:init\`.

## Layout

\`\`\`text
command-packs/${packSlug}/
  ${packSlug}${COMMAND_PACK_FILE_EXTENSION}
  README.md
  fixtures/
  scripts/
\`\`\`

## Safety

- Selecting this pack validates the manifest only.
- Scripts in \`scripts/\` are not executable authority by themselves.
- Do not store secrets, env files, provider keys, or credentials in this pack.
- Add commands conservatively and keep risky actions approval-gated.

## Next Steps

1. Update the manifest command examples.
2. Add pack-owned fixtures under \`fixtures/\` if needed.
3. Validate with CommandDeck before selecting the pack.
`;
}

function resolvePackInitControlRoot(rootDir, controlRoot) {
  if (!controlRoot || typeof controlRoot !== 'string') {
    throw new Error('controlRoot is required');
  }

  if (path.isAbsolute(controlRoot)) {
    return path.resolve(controlRoot);
  }

  return resolveRepoRelativePath(rootDir, controlRoot);
}

function assertCommandPackManifestPath(commandPackPath) {
  if (!isCommandPackManifestPath(commandPackPath)) {
    throw new Error(`command pack manifest path must end with ${COMMAND_PACK_FILE_EXTENSION}`);
  }
}

function isCommandPackManifestPath(commandPackPath) {
  return typeof commandPackPath === 'string' && commandPackPath.endsWith(COMMAND_PACK_FILE_EXTENSION);
}

function assertCustomPackCatalogPath(commandPackPath) {
  const normalizedPath = commandPackPath.split(path.sep).join(path.posix.sep);
  const parts = normalizedPath.split('/');

  if (parts.length !== 3 || parts[0] !== CUSTOM_PACK_CATALOG_DIR) {
    throw new Error(`external custom pack path must use ${CUSTOM_PACK_CATALOG_DIR}/<pack_slug>/<pack_slug>${COMMAND_PACK_FILE_EXTENSION}`);
  }

  const packSlug = parts[1];
  const expectedFilename = `${packSlug}${COMMAND_PACK_FILE_EXTENSION}`;

  if (!PACK_SLUG_PATTERN.test(packSlug) || parts[2] !== expectedFilename) {
    throw new Error(`external custom pack path must use ${CUSTOM_PACK_CATALOG_DIR}/<pack_slug>/<pack_slug>${COMMAND_PACK_FILE_EXTENSION}`);
  }
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

function isSafeLocalSource(source) {
  if (typeof source !== 'string' || !source.startsWith('local://')) {
    return false;
  }

  const descriptor = source.slice('local://'.length);
  return descriptor.length > 0 && !descriptor.startsWith('/') && !descriptor.includes('../');
}

function isLocalExactCommand(route, command) {
  return (
    route?.system === 'command-deck' &&
    route?.execution_boundary === 'allowlisted_local_runner' &&
    typeof command?.runner_action === 'string' &&
    Array.isArray(route.allowed_runner_actions) &&
    route.allowed_runner_actions.includes(command.runner_action)
  );
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

async function executeApprovedLocalAction(record, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const routes = options.routes ?? (await readJson(rootDir, 'contracts/routes/route-contracts.json'));
  const route = routes.routes.find((candidate) => candidate.id === record.route);

  if (!route || route.execution_boundary !== 'allowlisted_local_runner' || typeof record.action_key !== 'string') {
    return { executed: false };
  }

  if (!Array.isArray(route.allowed_runner_actions) || !route.allowed_runner_actions.includes(record.action_key)) {
    return { executed: false };
  }

  try {
    const result = await runAllowlistedLocalAction(record.action_key, {
      rootDir,
      executor: options.executor
    });

    return {
      executed: true,
      record: {
        ...record,
        approval_status: 'approved',
        result,
        errors: [],
        follow_up_owner: null
      }
    };
  } catch (error) {
    return {
      executed: true,
      record: {
        ...record,
        approval_status: 'approved',
        result: {
          status: 'failed_closed',
          summary: `Approved local action failed: ${error.message}`
        },
        errors: [`Approved local action failed: ${error.message}`],
        follow_up_owner: 'human_operator'
      }
    };
  }
}

function approvalStatusFor(command, route) {
  if (command.permission_level !== 'approval-required') {
    return 'not_required';
  }

  if (isLocalExactCommand(route, command)) {
    return 'requested_pending';
  }

  return 'blocked_execute_now_disabled';
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
  if (approvalStatus === 'requested_pending') {
    return result.summary;
  }

  if (approvalStatus === 'blocked_execute_now_disabled') {
    return `${result.summary} Approval would be required in a future phase.`;
  }

  return result.summary;
}

function blockedApprovalResultFor(command) {
  return {
    status: 'approval_requested',
    summary: `Approval is required before ${command.approval_prompt.action}.`,
    data: {
      pending_runner_action: command.runner_action,
      approval_target: command.approval_prompt.target
    }
  };
}

function buildMissingObjectConceptCheck({ input, commandText, timestamp, actionRequirements }) {
  const slots = parseSpokenCommandSlots(commandText, actionRequirements);

  if (!slots || slots.object) {
    return null;
  }

  const actionRequirement = actionRequirements.get(slots.action);
  const question = actionRequirement.missing_required_slot_ccq;
  const resumeToken = stableId('ccq', [
    input.actor_ref ?? DEFAULT_ACTOR,
    workspaceRefFor(input),
    input.adapter ?? DEFAULT_ADAPTER,
    commandText,
    timestamp
  ]);
  const expiresAt = new Date(new Date(timestamp).getTime() + CCQ_TOKEN_TTL_SECONDS * 1000).toISOString();
  const record = {
    record_id: stableId('rec', ['ccq', slots.action, commandText, timestamp]),
    command_id: 'unresolved',
    timestamp,
    actor_ref: input.actor_ref ?? DEFAULT_ACTOR,
    adapter: input.adapter ?? DEFAULT_ADAPTER,
    command_text: commandText,
    interpreted_intent: `${slots.action} command missing object`,
    permission_level: 'read-only',
    approval_status: 'required_not_requested',
    route: 'none',
    sources_used: [],
    model_provider_route: null,
    action_key: null,
    approval_request: null,
    result: {
      status: 'needs_clarification',
      summary: 'CommandDeck needs one more detail before routing.',
      clarification: {
        question,
        missing_slots: ['object'],
        partial_intent: {
          device_code: slots.device_code,
          action: slots.action,
          object: null,
          context: slots.context,
          end_code: slots.end_code
        },
        resume_token: resumeToken,
        resume_token_status: 'active',
        resume_token_expires_at: expiresAt,
        resume_token_used_at: null,
        workspace_ref: workspaceRefFor(input),
        adapter_session_ref: adapterSessionRefFor(input)
      }
    },
    errors: [],
    follow_up_owner: 'user'
  };

  return buildCommandResult({
    input,
    responseText: question,
    record
  });
}

function parseSpokenCommandSlots(commandText, actionRequirements) {
  const words = normalizeUtterance(commandText).split(' ').filter(Boolean);
  let index = 0;

  if (words.length === 0) {
    return null;
  }

  let deviceCode = null;
  if (SPOKEN_DEVICE_CODES.has(words[index])) {
    deviceCode = words[index];
    index += 1;
  }

  const action = words[index];
  if (!actionRequirements.has(action)) {
    return null;
  }
  index += 1;

  let endCode = null;
  if (words.length > index && SPOKEN_END_CODES.has(words[words.length - 1])) {
    endCode = words[words.length - 1];
    words.pop();
  }

  const objectWords = words.slice(index);

  return {
    device_code: deviceCode,
    action,
    object: objectWords.length > 0 ? objectWords.join(' ') : null,
    context: null,
    end_code: endCode
  };
}

function validateAndConsumeClarification(record, { input, resumeToken, timestamp }) {
  const clarification = record?.result?.clarification;
  const activeRecord = updateExpiredClarificationIfNeeded(record, timestamp);

  if (!clarification || record?.result?.status !== 'needs_clarification') {
    return invalidResume(activeRecord, 'rejected_invalid_record', 'Action record is not an active clarification record.');
  }

  if (!resumeToken || resumeToken !== clarification.resume_token) {
    return invalidResume(activeRecord, 'rejected_token_mismatch', 'Clarification token did not match.');
  }

  if (clarification.workspace_ref !== workspaceRefFor(input)) {
    return invalidResume(activeRecord, 'rejected_workspace_mismatch', 'Clarification workspace did not match.');
  }

  if (record.actor_ref !== (input.actor_ref ?? DEFAULT_ACTOR)) {
    return invalidResume(activeRecord, 'rejected_actor_mismatch', 'Clarification actor did not match.');
  }

  const inputSession = adapterSessionRefFor(input);
  if (clarification.adapter_session_ref && inputSession && clarification.adapter_session_ref !== inputSession) {
    return invalidResume(activeRecord, 'rejected_session_mismatch', 'Clarification adapter session did not match.');
  }

  if (activeRecord.result.clarification.resume_token_status !== 'active') {
    return {
      ok: false,
      resume_status: 'rejected_token_not_active',
      response_text: CCQ_DUPLICATE_RESPONSE,
      record: activeRecord,
      errors: [CCQ_DUPLICATE_RESPONSE]
    };
  }

  return { ok: true, record: activeRecord };
}

function updateExpiredClarificationIfNeeded(record, timestamp) {
  const clarification = record?.result?.clarification;
  if (!clarification || clarification.resume_token_status !== 'active') {
    return record;
  }

  const now = new Date(timestamp);
  const expiresAt = new Date(clarification.resume_token_expires_at);
  if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= now) {
    return updateClarificationStatus(record, {
      status: 'expired',
      timestamp,
      summary: CCQ_DUPLICATE_RESPONSE
    });
  }

  return record;
}

function invalidResume(record, resumeStatus, message) {
  return {
    ok: false,
    resume_status: resumeStatus,
    response_text: message,
    record: record ?? buildInvalidResumeRecord(message),
    errors: [message]
  };
}

function buildInvalidResumeRecord(message) {
  return {
    record_id: stableId('rec', ['invalid_ccq_resume', message]),
    command_id: 'unresolved',
    timestamp: new Date().toISOString(),
    actor_ref: DEFAULT_ACTOR,
    adapter: DEFAULT_ADAPTER,
    command_text: '',
    interpreted_intent: 'invalid clarification resume',
    permission_level: 'read-only',
    approval_status: 'required_not_requested',
    route: 'none',
    sources_used: [],
    model_provider_route: null,
    action_key: null,
    approval_request: null,
    result: {
      status: 'failed_closed',
      summary: message
    },
    errors: [message],
    follow_up_owner: 'human_operator'
  };
}

function mergeClarificationAnswer(clarification, answerText) {
  const partial = clarification.partial_intent;
  const pieces = [partial.action, answerText].filter(Boolean);
  return pieces.join(' ');
}

function answerAttemptsCommandRewrite(answerText, actionRequirements) {
  const words = normalizeUtterance(answerText).split(' ').filter(Boolean);
  const firstMeaningfulWord = words[0] === 'actually' || words[0] === 'instead' ? words[1] : words[0];

  return actionRequirements.has(firstMeaningfulWord);
}

function isClarificationRewrite(clarification, record) {
  const partial = clarification.partial_intent;

  if (record.result.status === 'failed_closed') {
    return false;
  }

  if (record.permission_level === 'approval-required' && partial.action !== 'open') {
    return true;
  }

  if (partial.action === 'open') {
    return !normalizeUtterance(record.command_text).startsWith('open ');
  }

  return false;
}

function updateClarificationStatus(record, { status, timestamp, summary }) {
  const clarification = record.result.clarification;
  return {
    ...record,
    result: {
      ...record.result,
      summary,
      clarification: {
        ...clarification,
        resume_token_status: status,
        resume_token_used_at: ['used', 'rejected'].includes(status) ? timestamp : clarification.resume_token_used_at
      }
    },
    errors: status === 'used' ? [] : [summary],
    follow_up_owner: status === 'used' ? null : 'human_operator'
  };
}

function workspaceRefFor(input) {
  return input.workspace_ref ?? input.workspaceRef ?? DEFAULT_WORKSPACE_REF;
}

function adapterSessionRefFor(input) {
  return input.adapter_session_ref ?? input.adapterSessionRef ?? input.request_id ?? null;
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
