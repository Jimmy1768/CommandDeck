import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { validateCommandPack } from '../packages/shell-core/index.mjs';

const root = path.resolve(import.meta.dirname, '..');

async function readJson(relativePath) {
  const contents = await readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(contents);
}

const forbiddenEffects = new Set([
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
  'execute_without_approval'
]);

test('permission contract keeps execute-now disabled', async () => {
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  assert.equal(permissions.execute_now_default, 'disabled');

  const executeNow = permissions.levels.find((level) => level.id === 'execute-now');
  assert.ok(executeNow);
  assert.equal(executeNow.enabled, false);
});

test('MVP command pack contains the first five commands only', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.json');
  assert.equal(pack.schema_version, '0.1');
  assert.equal(pack.commands.length, 5);

  const ids = pack.commands.map((command) => command.command_id);
  assert.deepEqual(ids, [
    'mvp.next_sourcegrid_task',
    'mvp.operator_queue_today',
    'mvp.draft_handoff',
    'mvp.operatorkit_dry_run',
    'mvp.apprelay_changes_today'
  ]);
});

test('command pack schema documents the Phase 1 loading boundary', async () => {
  const schema = await readJson('contracts/commands/command-pack.schema.json');

  assert.equal(schema.contract_kind, 'command-pack');
  assert.equal(schema.execute_now_enabled, false);
  assert.ok(schema.required.includes('schema_version'));
  assert.deepEqual(schema.allowed_permission_levels, ['read-only', 'draft-only', 'approval-required']);
  assert.deepEqual(schema.allowed_source_roots, ['evals/fixtures/']);
  assert.ok(schema.forbidden_command_fields.includes('handler'));
  assert.equal(schema.real_pack_locations.sourcegrid, 'sourcegrid-labs');
  assert.equal(schema.real_pack_locations.command_kit_repo, 'generic examples and tests only');
});

test('pack discovery schema is metadata-only and non-executing', async () => {
  const schema = await readJson('contracts/commands/pack-discovery.schema.json');

  assert.equal(schema.contract_kind, 'pack-discovery');
  assert.equal(schema.real_execution_enabled, false);
  assert.equal(schema.execute_now_enabled, false);
  assert.deepEqual(schema.allowed_discovery_modes, ['metadata_only']);
  assert.ok(schema.allowed_kinds.includes('owner-repo'));
  assert.ok(schema.forbidden_root_fields.includes('script'));
  assert.ok(schema.forbidden_root_fields.includes('secrets'));
  assert.equal(schema.allowed_repo_fixture_root, 'evals/fixtures/command-packs');
});

test('SourceGrid attachment schema keeps billing anchor outside owner repos', async () => {
  const schema = await readJson('contracts/attachments/sourcegrid-attachment.schema.json');

  assert.equal(schema.contract_kind, 'sourcegrid-attachment');
  assert.equal(schema.attachment_owner, 'sourcegrid');
  assert.equal(schema.billing_owner, 'sourcegrid_workspace');
  assert.equal(schema.commanddeck_stores_payment_data, false);
  assert.equal(schema.owner_repo_role, 'command_pack_source_only');
  assert.equal(schema.phase_1_apprelay_spend_enabled, false);
  assert.ok(schema.sourcegrid_credit_gate_scope.includes('apprelay_reasoning'));
  assert.ok(schema.not_blocked_by_credit_exhaustion.includes('local_exact_commands'));
  assert.ok(schema.not_blocked_by_credit_exhaustion.includes('voice_capture_surface'));
  assert.ok(schema.allowed_payment_method_states.includes('missing'));
  assert.ok(schema.allowed_payment_method_states.includes('verified'));
  assert.ok(schema.forbidden_local_payment_fields.includes('card_number'));
  assert.ok(schema.forbidden_local_payment_fields.includes('stripe_secret_key'));
});

test('generic command-pack fixtures validate without becoming executable integrations', async () => {
  const fixtureDir = path.join(root, 'evals/fixtures/command-packs');
  const fixtureFiles = (await readdir(fixtureDir)).filter((file) => file.endsWith('.json')).sort();
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');

  assert.deepEqual(fixtureFiles, ['generic-approval-blocked.pack.json', 'generic-read-draft.pack.json']);

  for (const file of fixtureFiles) {
    const pack = await readJson(`evals/fixtures/command-packs/${file}`);
    const errors = validateCommandPack(pack, { routes, permissions });

    assert.deepEqual(errors, [], `${file} should validate`);

    for (const command of pack.commands) {
      assert.notEqual(command.permission_level, 'execute-now');
      assert.ok(command.sources.every((source) => source.startsWith('evals/fixtures/')));
      assert.ok(command.forbidden_effects.includes('execute_now') || command.forbidden_effects.includes('external_call'));
    }
  }
});

test('command routes and permission levels match route contracts', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.json');
  const routes = await readJson('contracts/routes/route-contracts.json');
  const routeById = new Map(routes.routes.map((route) => [route.id, route]));

  assert.equal(routes.integration_mode, 'contract_only');

  for (const command of pack.commands) {
    const route = routeById.get(command.route);
    assert.ok(route, `missing route contract for ${command.route}`);
    assert.equal(route.real_integration, false, `${command.route} must not be real integration`);
    assert.ok(
      route.allowed_permission_levels.includes(command.permission_level),
      `${command.command_id} permission must be allowed by ${command.route}`
    );

    if (route.system === 'apprelay') {
      assert.equal(route.credit_policy, 'sourcegrid_credits_required_for_real_apprelay_spend');
    } else if (route.id.startsWith('local.')) {
      assert.equal(route.credit_policy, 'no_sourcegrid_credits_required');
    }
  }
});

test('command sources point to local fixtures', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.json');

  for (const command of pack.commands) {
    for (const source of command.sources) {
      assert.match(source, /^evals\/fixtures\//);
      await access(path.join(root, source));
    }
  }
});

test('approval-required command is blocked in slice 1', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.json');
  const dryRun = pack.commands.find((command) => command.command_id === 'mvp.operatorkit_dry_run');

  assert.ok(dryRun);
  assert.equal(dryRun.permission_level, 'approval-required');
  assert.ok(dryRun.approval_prompt);
  assert.ok(dryRun.allowed_effects.includes('blocked_pending_explicit_approval'));
  assert.ok(dryRun.forbidden_effects.includes('execute_now'));
});

test('eval cases match command contracts and do not claim real execution', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.json');
  const suite = await readJson('evals/cases/mvp.slice1.cases.json');
  const commandById = new Map(pack.commands.map((command) => [command.command_id, command]));

  assert.equal(suite.cases.length, 5);

  for (const evalCase of suite.cases) {
    const command = commandById.get(evalCase.command_id);
    assert.ok(command, `missing command for ${evalCase.command_id}`);
    assert.equal(evalCase.expected.permission_level, command.permission_level);
    assert.equal(evalCase.expected.route, command.route);
    assert.notEqual(evalCase.expected.result_status, 'executed');

    const illegalAllowedEffects = command.allowed_effects.filter((effect) => forbiddenEffects.has(effect));
    assert.deepEqual(illegalAllowedEffects, []);

    if (command.permission_level === 'approval-required') {
      assert.equal(evalCase.expected.approval_status, 'blocked_execute_now_disabled');
      assert.equal(evalCase.expected.result_status, 'blocked_contract_only');
    }
  }
});

test('voice adapters are IO surfaces and AppRelay owns reasoning', async () => {
  const contract = await readJson('contracts/routes/voice-adapters.json');

  assert.equal(contract.voice_adapters_are_io_surfaces, true);
  assert.equal(contract.reasoning_owner, 'apprelay');
  assert.equal(contract.command_shell_owner, 'command-deck');

  const adaptersById = new Map(contract.adapters.map((adapter) => [adapter.id, adapter]));
  assert.equal(adaptersById.get('apple_shortcuts').provides_reasoning, false);
  assert.equal(adaptersById.get('apple_shortcuts').requires_apple_intelligence, false);
  assert.equal(adaptersById.get('google_voice').provides_reasoning, false);

  const responseModes = contract.response_modes.map((mode) => mode.id);
  assert.ok(responseModes.includes('platform_tts'));
  assert.ok(responseModes.includes('apprelay_audio'));
});

test('adapter response schema keeps voice adapters as IO surfaces', async () => {
  const schema = await readJson('contracts/routes/adapter-response.schema.json');

  assert.equal(schema.contract_kind, 'adapter-response');
  assert.equal(schema.adapter_role, 'input_output_surface');
  assert.equal(schema.reasoning_owner, 'apprelay');
  assert.equal(schema.apprelay_audio_available, false);
  assert.equal(schema.platform_reasoning_used, false);
  assert.equal(schema.apple_intelligence_required, false);
  assert.equal(schema.google_reasoning_required, false);
  assert.deepEqual(schema.response_modes, ['platform_tts', 'display_text', 'json']);

  for (const field of ['display_text', 'spoken_text', 'record_ref', 'permission_level', 'approval_status']) {
    assert.ok(schema.required.includes(field));
  }
});

test('adapter response fixtures are safe for Siri spoken output', async () => {
  const nextTask = await readJson('evals/fixtures/adapter_responses/apple_shortcuts.next_task.response.json');
  const blocked = await readJson('evals/fixtures/adapter_responses/apple_shortcuts.operatorkit_blocked.response.json');
  const google = await readJson('evals/fixtures/adapter_responses/google_voice.next_task.response.json');

  assert.equal(nextTask.adapter, 'apple_shortcuts');
  assert.equal(blocked.adapter, 'apple_shortcuts');
  assert.equal(google.adapter, 'google_voice');

  for (const response of [nextTask, blocked, google]) {
    assert.equal(response.response_mode, 'platform_tts');
    assert.equal(response.spoken_text, response.display_text);
    assert.equal(response.apprelay_audio_available, false);
    assert.equal(response.apple_intelligence_required, false);
    assert.equal(response.platform_reasoning_used, false);
    assert.equal(response.google_reasoning_required, false);
  }

  assert.equal(blocked.approval_status, 'blocked_execute_now_disabled');
  assert.match(blocked.spoken_text, /Approval would be required/);
});
