import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  classifyCommand,
  normalizeUtterance,
  resolveRecordDir,
  runLocalCommand,
  writeActionRecord
} from '../packages/shell-core/index.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const timestamp = '2026-06-11T00:00:00.000Z';

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
