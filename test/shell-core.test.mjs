import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  applyApprovalDecision,
  buildAdapterResponseEnvelope,
  buildSourceGridAttachmentStatus,
  classifyCommand,
  loadAdapterRequest,
  loadCommandDeckConfig,
  loadCommandPack,
  normalizeUtterance,
  resolveEvalReportPath,
  resolveRecordDir,
  runApprovalDecisionEvalSuite,
  runEvalSuite,
  runLocalCommand,
  validateAdapterRequest,
  validateAdapterResponseEnvelope,
  validateApprovalDecision,
  validateCommandDeckConfig,
  validateCommandPack,
  validateCommandPackRoots,
  validateSourceGridAttachment,
  writeEvalReport,
  writeActionRecord
} from '../packages/shell-core/index.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const timestamp = '2026-06-11T00:00:00.000Z';

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(rootDir, relativePath), 'utf8'));
}

test('normalizes MVP utterances without punctuation sensitivity', () => {
  assert.equal(normalizeUtterance("Summarize today's operator queue."), 'summarize todays operator queue');
});

test('classifies exact MVP utterance variants', () => {
  const commands = [
    {
      command_id: 'mvp.next_sourcegrid_task',
      example_utterances: ['What is my next SourceGrid task?']
    }
  ];

  const command = classifyCommand(commands, 'what is my next sourcegrid task');
  assert.equal(command.command_id, 'mvp.next_sourcegrid_task');
});

test('answers read-only MVP command from fixture only', async () => {
  const result = await runLocalCommand(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      command_text: 'What is my next SourceGrid task?'
    },
    { rootDir, timestamp }
  );

  assert.equal(result.record.command_id, 'mvp.next_sourcegrid_task');
  assert.equal(result.record.permission_level, 'read-only');
  assert.equal(result.record.approval_status, 'not_required');
  assert.equal(result.record.result.status, 'answered_from_fixture');
  assert.match(result.response_text, /Review CommandDeck repo skeleton/);
  assert.equal(result.adapter_response.display_text, result.response_text);
  assert.equal(result.adapter_response.spoken_text, result.response_text);
  assert.equal(result.adapter_response.record_ref, result.record.record_id);
  assert.equal(result.adapter_response.response_mode, 'display_text');
  assert.equal(result.adapter_response.apprelay_audio_available, false);
  assert.deepEqual(validateAdapterResponseEnvelope(result.adapter_response), []);
});

test('Siri request gets platform TTS adapter response without platform reasoning', async () => {
  const result = await runLocalCommand(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      command_text: 'What is my next SourceGrid task?',
      requested_output: 'spoken_summary'
    },
    { rootDir, timestamp }
  );

  assert.equal(result.adapter_response.adapter, 'apple_shortcuts');
  assert.equal(result.adapter_response.response_mode, 'platform_tts');
  assert.equal(result.adapter_response.spoken_text, 'Next task: Review CommandDeck repo skeleton.');
  assert.equal(result.adapter_response.display_text, result.adapter_response.spoken_text);
  assert.equal(result.adapter_response.reasoning_owner, 'apprelay');
  assert.equal(result.adapter_response.platform_reasoning_used, false);
  assert.equal(result.adapter_response.apple_intelligence_required, false);
  assert.equal(result.adapter_response.google_reasoning_required, false);
});

test('draft-only MVP command returns draft data without sending anything', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'Create a draft handoff for this task.'
    },
    { rootDir, timestamp }
  );

  assert.equal(result.record.command_id, 'mvp.draft_handoff');
  assert.equal(result.record.permission_level, 'draft-only');
  assert.equal(result.record.result.status, 'drafted_fixture_only');
  assert.ok(result.record.result.data.draft);
  assert.equal(result.record.action_key, null);
});

test('approval-required dry run is blocked and not routed to real OperatorKit', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'Start an OperatorKit dry run for this repo.'
    },
    { rootDir, timestamp }
  );

  assert.equal(result.record.command_id, 'mvp.operatorkit_dry_run');
  assert.equal(result.record.permission_level, 'approval-required');
  assert.equal(result.record.approval_status, 'blocked_execute_now_disabled');
  assert.equal(result.record.result.status, 'blocked_contract_only');
  assert.equal(result.record.follow_up_owner, 'human_operator');
  assert.deepEqual(result.record.approval_request, {
    target: 'OperatorKit dry run for current repo',
    action: 'request dry-run workflow',
    risk: 'would invoke external execution layer in future phases',
    expected_record: 'action record with approval decision'
  });
  assert.match(result.response_text, /not started/);
  assert.equal(result.adapter_response.response_mode, 'display_text');
  assert.equal(result.adapter_response.approval_status, 'blocked_execute_now_disabled');
  assert.match(result.adapter_response.spoken_text, /Approval would be required/);
  assert.equal(result.adapter_response.apprelay_audio_available, false);
});

test('unknown commands fail closed', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'Deploy production now'
    },
    { rootDir, timestamp }
  );

  assert.equal(result.record.command_id, 'unknown');
  assert.equal(result.record.result.status, 'failed_closed');
  assert.equal(result.record.follow_up_owner, 'human_operator');
  assert.equal(result.record.sources_used.length, 0);
  assert.equal(result.adapter_response.record_ref, result.record.record_id);
  assert.equal(result.adapter_response.errors.length, 1);
  assert.equal(result.adapter_response.apprelay_audio_available, false);
});

test('adapter response envelope validates required fields and disabled audio', () => {
  const envelope = buildAdapterResponseEnvelope(
    {
      adapter: 'google_voice',
      record_id: 'rec_test',
      permission_level: 'read-only',
      approval_status: 'not_required',
      route: 'local.fixture_read',
      errors: []
    },
    'Fixture response.',
    {
      requestedOutput: 'spoken_summary'
    }
  );

  assert.equal(envelope.adapter, 'google_voice');
  assert.equal(envelope.response_mode, 'platform_tts');
  assert.equal(envelope.apprelay_audio_available, false);
  assert.equal(envelope.apple_intelligence_required, false);
  assert.equal(envelope.google_reasoning_required, false);
  assert.deepEqual(validateAdapterResponseEnvelope(envelope), []);

  const unsafeEnvelope = {
    ...envelope,
    apprelay_audio_available: true,
    platform_reasoning_used: true
  };
  const errors = validateAdapterResponseEnvelope(unsafeEnvelope);
  assert.ok(errors.some((error) => error.includes('apprelay_audio_available')));
  assert.ok(errors.some((error) => error.includes('platform_reasoning_used')));
});

test('writes action records only when called explicitly', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'command-deck-records-'));
  const result = await runLocalCommand(
    {
      command_text: 'What is my next SourceGrid task?'
    },
    { rootDir, timestamp }
  );

  const writeResult = await writeActionRecord(result.record, {
    rootDir: tempRoot,
    recordDir: 'records/actions'
  });

  assert.match(writeResult.record_path, /^records\/actions\/rec_/);

  const written = JSON.parse(await readFile(path.join(tempRoot, writeResult.record_path), 'utf8'));
  assert.equal(written.record_id, result.record.record_id);
  assert.equal(written.result.status, 'answered_from_fixture');
});

test('record directories must stay repo-relative', () => {
  assert.throws(() => resolveRecordDir(rootDir, '/tmp/command-deck-records'));
  assert.throws(() => resolveRecordDir(rootDir, '../outside-command-deck'));
  assert.equal(resolveRecordDir(rootDir, 'records/actions'), path.join(rootDir, 'records/actions'));
});

test('CLI is print-only by default and does not create the requested record directory', async () => {
  const recordDir = `records/no-write-${Date.now()}`;
  const output = spawnSync(
    process.execPath,
    ['bin/command-deck.mjs', '--record-dir', recordDir, 'What is my next SourceGrid task?'],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record_write.status, 'not_written');
  await assert.rejects(() => stat(path.join(rootDir, recordDir)), { code: 'ENOENT' });
});

test('loads the default command pack through validation', async () => {
  const pack = await loadCommandPack({ rootDir });

  assert.equal(pack.pack_id, 'commanddeck.mvp.slice1');
  assert.equal(pack.commands.length, 5);
});

test('runs with an explicit repo-relative command pack path', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'What changed in AppRelay today?'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/mvp-commands.json'
    }
  );

  assert.equal(result.record.command_id, 'mvp.apprelay_changes_today');
  assert.equal(result.record.result.data.real_apprelay_read, false);
});

test('rejects command packs with executable fields or unsafe sources', async () => {
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const pack = await readJson('contracts/commands/mvp-commands.json');
  const unsafePack = structuredClone(pack);

  unsafePack.commands[0].script = './do-real-work.sh';
  unsafePack.commands[0].sources = ['../sourcegrid-labs/private.json'];

  const errors = validateCommandPack(unsafePack, { routes, permissions });
  assert.ok(errors.some((error) => error.includes('forbidden executable field script')));
  assert.ok(errors.some((error) => error.includes('source must be repo-relative under evals/fixtures')));
});

test('command pack paths must stay inside the repo', async () => {
  await assert.rejects(
    () =>
      loadCommandPack({
        rootDir,
        commandPackPath: '/tmp/not-a-command-pack.json'
      }),
    /repo-relative/
  );

  await assert.rejects(
    () =>
      loadCommandPack({
        rootDir,
        commandPackPath: '../outside-command-deck.json'
      }),
    /inside the repo/
  );
});

test('CLI accepts an explicit command pack without writing records', async () => {
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      '--command-pack',
      'contracts/commands/mvp-commands.json',
      'What is my next SourceGrid task?'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record.command_id, 'mvp.next_sourcegrid_task');
  assert.equal(parsed.record_write.status, 'not_written');
});

test('uses safe config defaults when no local config file exists', async () => {
  const config = await loadCommandDeckConfig({ rootDir });

  assert.equal(config.config_path, null);
  assert.equal(config.default_command_pack, 'contracts/commands/mvp-commands.json');
  assert.equal(config.default_record_dir, 'records/actions');
  assert.equal(config.default_write_records, false);
});

test('loads the explicit example config', async () => {
  const config = await loadCommandDeckConfig({
    rootDir,
    configPath: 'commanddeck.config.example.json'
  });

  assert.equal(config.config_path, 'commanddeck.config.example.json');
  assert.equal(config.default_command_pack, 'contracts/commands/mvp-commands.json');
  assert.equal(config.default_write_records, false);
  assert.equal(config.command_pack_roots[0].discovery_mode, 'metadata_only');
  assert.equal(config.command_pack_roots[1].repo_slug, 'sourcegrid-labs');
  assert.equal(config.sourcegrid_attachment.billing_owner, 'sourcegrid_workspace');
  assert.equal(config.sourcegrid_attachment.payment_method_state, 'missing');
  assert.equal(config.sourcegrid_attachment.command_pack_owner_repos[0], 'sourcegrid-labs');
});

test('builds SourceGrid attachment status without enabling AppRelay spend', async () => {
  const config = await loadCommandDeckConfig({
    rootDir,
    configPath: 'commanddeck.config.example.json'
  });

  const status = buildSourceGridAttachmentStatus(config);

  assert.equal(status.status, 'contract_only');
  assert.equal(status.billing_owner, 'sourcegrid_workspace');
  assert.equal(status.payment_method_state, 'missing');
  assert.equal(status.apprelay_spend_ready, false);
  assert.equal(status.command_pack_repo_ready, true);
  assert.equal(status.local_routes_available_without_credits, true);
  assert.equal(status.voice_capture_available_without_credits, true);
  assert.equal(status.platform_tts_available_without_credits, true);
  assert.ok(status.sourcegrid_credit_gate_scope.includes('apprelay_reasoning'));
  assert.equal(status.local_payment_data_allowed, false);
  assert.deepEqual(status.errors, []);
});

test('rejects SourceGrid attachment with raw payment fields', () => {
  const errors = validateSourceGridAttachment({
    schema_version: '0.1',
    status: 'attached',
    sourcegrid_workspace_ref: 'workspace_sourcegrid_fixture',
    sourcegrid_account_ref: 'account_sourcegrid_fixture',
    billing_owner: 'sourcegrid_workspace',
    payment_method_state: 'verified',
    payment_method_label: 'Visa ending 4242',
    apprelay_spend_policy: 'enabled_after_payment_verified',
    command_pack_owner_repos: ['sourcegrid-labs'],
    card_number: '4242424242424242'
  });

  assert.ok(errors.some((error) => error.includes('forbidden field card_number')));
});

test('loads metadata-only pack discovery fixture config', async () => {
  const config = await loadCommandDeckConfig({
    rootDir,
    configPath: 'evals/fixtures/pack_discovery/metadata-only.config.json'
  });

  assert.equal(config.config_path, 'evals/fixtures/pack_discovery/metadata-only.config.json');
  assert.equal(config.command_pack_roots.length, 2);
  assert.equal(config.command_pack_roots[0].kind, 'repo-fixture');
  assert.equal(config.command_pack_roots[1].enabled, false);
});

test('rejects configs that enable writes or include nested secret-bearing fields', () => {
  const errors = validateCommandDeckConfig(
    {
      schema_version: '0.1',
      default_command_pack: 'contracts/commands/mvp-commands.json',
      default_record_dir: 'records/actions',
      default_write_records: true,
      adapters: {
        apple_shortcuts: {
          secrets: {
            provider: 'not-allowed'
          }
        }
      }
    },
    { rootDir }
  );

  assert.ok(errors.some((error) => error.includes('default_write_records must remain false')));
  assert.ok(errors.some((error) => error.includes('forbidden field adapters.apple_shortcuts.secrets')));
});

test('rejects unsafe pack discovery roots', async () => {
  const unsafeConfig = await readJson('evals/fixtures/pack_discovery/unsafe-executable.config.json');
  const errors = validateCommandDeckConfig(unsafeConfig, { rootDir });

  assert.ok(errors.some((error) => error.includes('discovery_mode must be metadata_only')));
  assert.ok(errors.some((error) => error.includes('forbidden field script')));
  assert.ok(errors.some((error) => error.includes('forbidden field secrets')));
  assert.ok(errors.some((error) => error.includes('absolute paths require local_only true')));
});

test('pack discovery roots enforce repo fixture and local-only path boundaries', () => {
  const errors = validateCommandPackRoots(
    [
      {
        id: 'bad_fixture',
        kind: 'repo-fixture',
        path: 'contracts/commands',
        enabled: true,
        discovery_mode: 'metadata_only'
      },
      {
        id: 'bad_local',
        kind: 'local-folder',
        path: '.commanddeck/command-packs',
        enabled: false,
        discovery_mode: 'metadata_only'
      },
      {
        id: 'bad_owner',
        kind: 'owner-repo',
        path: 'sourcegrid-labs',
        repo_slug: 'sourcegrid-labs',
        enabled: false,
        discovery_mode: 'metadata_only'
      }
    ],
    { rootDir }
  );

  assert.ok(errors.some((error) => error.includes('repo-fixture path must stay under evals/fixtures/command-packs')));
  assert.ok(errors.some((error) => error.includes('local-folder roots require local_only true')));
  assert.ok(errors.some((error) => error.includes('owner-repo roots must not declare a local path')));
});

test('config paths must stay inside the repo', async () => {
  await assert.rejects(
    () =>
      loadCommandDeckConfig({
        rootDir,
        configPath: '/tmp/commanddeck.config.json'
      }),
    /repo-relative/
  );
});

test('CLI accepts explicit config without enabling record writes', async () => {
  const output = spawnSync(
    process.execPath,
    ['bin/command-deck.mjs', '--config', 'commanddeck.config.example.json', 'What is my next SourceGrid task?'],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record.command_id, 'mvp.next_sourcegrid_task');
  assert.equal(parsed.record_write.status, 'not_written');
});

test('CLI reports SourceGrid attachment and AppRelay billing readiness', async () => {
  const output = spawnSync(
    process.execPath,
    ['bin/command-deck.mjs', 'sourcegrid:status', '--config', 'commanddeck.config.example.json'],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.status, 'contract_only');
  assert.equal(parsed.sourcegrid_workspace_ref, 'workspace_sourcegrid_fixture');
  assert.equal(parsed.payment_method_state, 'missing');
  assert.equal(parsed.apprelay_spend_ready, false);
  assert.equal(parsed.local_routes_available_without_credits, true);
  assert.equal(parsed.local_payment_data_allowed, false);
});

test('loads a Siri Shortcuts-shaped adapter request fixture', async () => {
  const request = await loadAdapterRequest({
    rootDir,
    requestPath: 'evals/fixtures/adapter_requests/apple_shortcuts.next_task.json'
  });

  assert.equal(request.adapter, 'apple_shortcuts');
  assert.equal(request.actor_ref, 'director');
  assert.equal(request.surface_hint, 'phone');
  assert.equal(request.device_code, 'command');
  assert.equal(request.target_runner, 'command');
  assert.equal(request.command_text, 'What is my next SourceGrid task?');
  assert.equal(request.requested_output, 'spoken_summary');
});

test('loads a Google voice-shaped adapter request fixture as contract-only IO', async () => {
  const request = await loadAdapterRequest({
    rootDir,
    requestPath: 'evals/fixtures/adapter_requests/google_voice.next_task.json'
  });

  assert.equal(request.adapter, 'google_voice');
  assert.equal(request.actor_ref, 'director');
  assert.equal(request.surface_hint, 'phone');
  assert.equal(request.device_code, 'command');
  assert.equal(request.target_runner, 'command');
  assert.equal(request.command_text, 'What is my next SourceGrid task?');
  assert.equal(request.requested_output, 'spoken_summary');

  const result = await runLocalCommand(request, { rootDir, timestamp });
  assert.equal(result.adapter_response.adapter, 'google_voice');
  assert.equal(result.adapter_response.response_mode, 'platform_tts');
  assert.equal(result.adapter_response.reasoning_owner, 'apprelay');
  assert.equal(result.adapter_response.google_reasoning_required, false);
  assert.equal(result.adapter_response.apprelay_audio_available, false);
});

test('rejects adapter requests with missing required fields or nested secrets', () => {
  const errors = validateAdapterRequest({
    adapter: 'apple_shortcuts',
    actor_ref: 'director',
    requested_output: 'spoken_summary',
    device_context: {
      token: 'not-allowed'
    }
  });

  assert.ok(errors.some((error) => error.includes('command_text is required')));
  assert.ok(errors.some((error) => error.includes('device_context.token')));
});

test('rejects local_cli as a voice surface hint', () => {
  const errors = validateAdapterRequest({
    adapter: 'apple_shortcuts',
    actor_ref: 'director',
    command_text: 'What is my next SourceGrid task?',
    requested_output: 'spoken_summary',
    surface_hint: 'local_cli',
    target_runner: 'command'
  });

  assert.ok(errors.some((error) => error.includes('surface_hint must be one of phone, watch, glasses, computer')));
});

test('rejects adapter requests that try to carry approval data', () => {
  const errors = validateAdapterRequest({
    adapter: 'apple_shortcuts',
    actor_ref: 'director',
    command_text: 'Start an OperatorKit dry run for this repo.',
    requested_output: 'display_text',
    approval_decision: {
      decision: 'approved'
    }
  });

  assert.ok(errors.some((error) => error.includes('approval_decision')));
});

test('adapter request paths must stay inside the repo', async () => {
  await assert.rejects(
    () =>
      loadAdapterRequest({
        rootDir,
        requestPath: '/tmp/apple-shortcuts.json'
      }),
    /repo-relative/
  );
});

test('CLI accepts adapter request files without writing records', async () => {
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      '--request-file',
      'evals/fixtures/adapter_requests/apple_shortcuts.next_task.json'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record.adapter, 'apple_shortcuts');
  assert.equal(parsed.record.actor_ref, 'director');
  assert.equal(parsed.record.command_id, 'mvp.next_sourcegrid_task');
  assert.equal(parsed.adapter_response.response_mode, 'platform_tts');
  assert.equal(parsed.adapter_response.record_ref, parsed.record.record_id);
  assert.equal(parsed.record_write.status, 'not_written');
});

test('CLI accepts Google voice request files without writing records', async () => {
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      '--request-file',
      'evals/fixtures/adapter_requests/google_voice.next_task.json'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record.adapter, 'google_voice');
  assert.equal(parsed.record.command_id, 'mvp.next_sourcegrid_task');
  assert.equal(parsed.adapter_response.adapter, 'google_voice');
  assert.equal(parsed.adapter_response.response_mode, 'platform_tts');
  assert.equal(parsed.adapter_response.google_reasoning_required, false);
  assert.equal(parsed.record_write.status, 'not_written');
});

test('runs MVP eval suite without writing reports', async () => {
  const report = await runEvalSuite({
    rootDir,
    suitePath: 'evals/cases/mvp.slice1.cases.json',
    timestamp
  });

  assert.equal(report.suite_id, 'mvp.slice1');
  assert.equal(report.summary.total, 5);
  assert.equal(report.summary.passed, 5);
  assert.equal(report.summary.failed, 0);
  assert.ok(report.cases.every((evalCase) => evalCase.passed));
  const dryRun = report.cases.find((evalCase) => evalCase.command_id === 'mvp.operatorkit_dry_run');
  assert.ok(dryRun.checks.some((check) => check.name === 'approval_request_required' && check.passed));
});

test('eval report paths must stay under evals reports as JSON', () => {
  assert.equal(
    resolveEvalReportPath(rootDir, 'evals/reports/mvp.slice1.latest.json'),
    path.join(rootDir, 'evals/reports/mvp.slice1.latest.json')
  );
  assert.throws(() => resolveEvalReportPath(rootDir, 'records/actions/eval.json'), /evals\/reports/);
  assert.throws(() => resolveEvalReportPath(rootDir, 'evals/reports/mvp.slice1.txt'), /JSON/);
});

test('writes eval reports only when called explicitly', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'command-deck-evals-'));
  const report = await runEvalSuite({
    rootDir,
    suitePath: 'evals/cases/mvp.slice1.cases.json',
    timestamp
  });

  const writeResult = await writeEvalReport(report, {
    rootDir: tempRoot,
    reportPath: 'evals/reports/mvp.slice1.latest.json'
  });

  assert.equal(writeResult.report_path, 'evals/reports/mvp.slice1.latest.json');
  const written = JSON.parse(await readFile(path.join(tempRoot, writeResult.report_path), 'utf8'));
  assert.equal(written.summary.failed, 0);
});

test('MVP eval CLI prints report without writing by default', async () => {
  const output = spawnSync(process.execPath, ['scripts/run-evals.mjs'], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.summary.total, 5);
  assert.equal(parsed.summary.failed, 0);
  assert.equal(parsed.report_write.status, 'not_written');
});

test('runs safety eval suite and verifies high-risk commands fail closed', async () => {
  const report = await runEvalSuite({
    rootDir,
    suitePath: 'evals/cases/safety.slice1.cases.json',
    timestamp
  });

  assert.equal(report.suite_id, 'safety.slice1');
  assert.equal(report.summary.total, 4);
  assert.equal(report.summary.passed, 4);
  assert.equal(report.summary.failed, 0);
  assert.ok(report.cases.every((evalCase) => evalCase.record.result.status === 'failed_closed'));
});

test('safety eval CLI prints passing report without writing by default', async () => {
  const output = spawnSync(process.execPath, ['scripts/run-evals.mjs', '--suite', 'evals/cases/safety.slice1.cases.json'], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.summary.total, 4);
  assert.equal(parsed.summary.failed, 0);
  assert.equal(parsed.report_write.status, 'not_written');
});

test('applies denied approval decision without execution', async () => {
  const record = await readJson('evals/fixtures/action_records/operatorkit_dry_run.blocked.json');
  const decision = await readJson('evals/fixtures/approval_decisions/operatorkit_dry_run.denied.json');
  const result = applyApprovalDecision(record, decision, {
    now: '2026-06-11T00:10:00.000Z'
  });

  assert.equal(result.decision_status, 'denied_no_execution');
  assert.equal(result.approval_status, 'denied');
  assert.equal(result.result.status, 'blocked_contract_only');
});

test('approved approval decision still cannot execute in Phase 1', async () => {
  const record = await readJson('evals/fixtures/action_records/operatorkit_dry_run.blocked.json');
  const decision = await readJson('evals/fixtures/approval_decisions/operatorkit_dry_run.approved.json');
  const result = applyApprovalDecision(record, decision, {
    now: '2026-06-11T00:10:00.000Z'
  });

  assert.equal(result.decision_status, 'approved_execution_disabled');
  assert.equal(result.approval_status, 'approved');
  assert.equal(result.result.status, 'blocked_contract_only');
});

test('expired approval decision is rejected', async () => {
  const record = await readJson('evals/fixtures/action_records/operatorkit_dry_run.blocked.json');
  const decision = await readJson('evals/fixtures/approval_decisions/operatorkit_dry_run.expired.json');
  const result = applyApprovalDecision(record, decision, {
    now: '2026-06-11T00:10:00.000Z'
  });

  assert.equal(result.decision_status, 'rejected_expired');
  assert.ok(result.errors.includes('approval decision is expired'));
});

test('approval decision scope must match approval request', async () => {
  const record = await readJson('evals/fixtures/action_records/operatorkit_dry_run.blocked.json');
  const decision = await readJson('evals/fixtures/approval_decisions/operatorkit_dry_run.approved.json');
  const mismatchedDecision = structuredClone(decision);
  mismatchedDecision.scope.action = 'dispatch production workflow';

  const errors = validateApprovalDecision(record, mismatchedDecision, {
    now: '2026-06-11T00:10:00.000Z'
  });

  assert.ok(errors.some((error) => error.includes('scope action')));
});

test('runs approval decision eval suite', async () => {
  const report = await runApprovalDecisionEvalSuite({
    rootDir,
    suitePath: 'evals/cases/approval.slice1.cases.json'
  });

  assert.equal(report.suite_id, 'approval.slice1');
  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.passed, 3);
  assert.equal(report.summary.failed, 0);
});

test('approval eval CLI prints passing report without writing by default', async () => {
  const output = spawnSync(
    process.execPath,
    ['scripts/run-evals.mjs', '--kind', 'approval', '--suite', 'evals/cases/approval.slice1.cases.json'],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.summary.total, 3);
  assert.equal(parsed.summary.failed, 0);
  assert.equal(parsed.report_write.status, 'not_written');
});
