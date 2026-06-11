import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  classifyCommand,
  loadAdapterRequest,
  loadCommandKitConfig,
  loadCommandPack,
  normalizeUtterance,
  resolveEvalReportPath,
  resolveRecordDir,
  runEvalSuite,
  runLocalCommand,
  validateAdapterRequest,
  validateCommandKitConfig,
  validateCommandPack,
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
  assert.match(result.response_text, /Review CommandKit repo skeleton/);
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
  assert.match(result.response_text, /not started/);
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
});

test('writes action records only when called explicitly', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'command-kit-records-'));
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
  assert.throws(() => resolveRecordDir(rootDir, '/tmp/command-kit-records'));
  assert.throws(() => resolveRecordDir(rootDir, '../outside-command-kit'));
  assert.equal(resolveRecordDir(rootDir, 'records/actions'), path.join(rootDir, 'records/actions'));
});

test('CLI is print-only by default and does not create the requested record directory', async () => {
  const recordDir = `records/no-write-${Date.now()}`;
  const output = spawnSync(
    process.execPath,
    ['bin/command-kit.mjs', '--record-dir', recordDir, 'What is my next SourceGrid task?'],
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

  assert.equal(pack.pack_id, 'commandkit.mvp.slice1');
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
        commandPackPath: '../outside-command-kit.json'
      }),
    /inside the repo/
  );
});

test('CLI accepts an explicit command pack without writing records', async () => {
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-kit.mjs',
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
  const config = await loadCommandKitConfig({ rootDir });

  assert.equal(config.config_path, null);
  assert.equal(config.default_command_pack, 'contracts/commands/mvp-commands.json');
  assert.equal(config.default_record_dir, 'records/actions');
  assert.equal(config.default_write_records, false);
});

test('loads the explicit example config', async () => {
  const config = await loadCommandKitConfig({
    rootDir,
    configPath: 'commandkit.config.example.json'
  });

  assert.equal(config.config_path, 'commandkit.config.example.json');
  assert.equal(config.default_command_pack, 'contracts/commands/mvp-commands.json');
  assert.equal(config.default_write_records, false);
});

test('rejects configs that enable writes or include secret-bearing fields', () => {
  const errors = validateCommandKitConfig(
    {
      schema_version: '0.1',
      default_command_pack: 'contracts/commands/mvp-commands.json',
      default_record_dir: 'records/actions',
      default_write_records: true,
      secrets: {
        provider: 'not-allowed'
      }
    },
    { rootDir }
  );

  assert.ok(errors.some((error) => error.includes('default_write_records must remain false')));
  assert.ok(errors.some((error) => error.includes('forbidden field secrets')));
});

test('config paths must stay inside the repo', async () => {
  await assert.rejects(
    () =>
      loadCommandKitConfig({
        rootDir,
        configPath: '/tmp/commandkit.config.json'
      }),
    /repo-relative/
  );
});

test('CLI accepts explicit config without enabling record writes', async () => {
  const output = spawnSync(
    process.execPath,
    ['bin/command-kit.mjs', '--config', 'commandkit.config.example.json', 'What is my next SourceGrid task?'],
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

test('loads a Siri Shortcuts-shaped adapter request fixture', async () => {
  const request = await loadAdapterRequest({
    rootDir,
    requestPath: 'evals/fixtures/adapter_requests/apple_shortcuts.next_task.json'
  });

  assert.equal(request.adapter, 'apple_shortcuts');
  assert.equal(request.actor_ref, 'director');
  assert.equal(request.command_text, 'What is my next SourceGrid task?');
  assert.equal(request.requested_output, 'spoken_summary');
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
      'bin/command-kit.mjs',
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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'command-kit-evals-'));
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
