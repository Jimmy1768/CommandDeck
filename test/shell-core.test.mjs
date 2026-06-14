import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, stat, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  applyApprovalDecision,
  applySourceGridPackSelection,
  buildAdapterResponseEnvelope,
  buildActiveCommandPackStatus,
  buildCommandDeckResponseForSourceGridProxyResponse,
  buildSourceGridAppRelayProxyRequest,
  buildSourceGridAttachmentStatus,
  classifyCalibrationCommand,
  classifyCommand,
  loadAdapterRequest,
  loadCalibrationCommands,
  loadCommandDeckConfig,
  loadCommandPack,
  loadCoreActionRequirements,
  loadRecentCommandPacks,
  loadSourceGridPackSelection,
  initCommandPack,
  normalizeUtterance,
  openCommandPack,
  resumeConceptCheckingQuestion,
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
  validateCoreActionRequirements,
  validateSourceGridPackSelection,
  validateSourceGridAttachment,
  validateSourceGridAppRelayProxyRequest,
  validateSourceGridAppRelayProxyResponse,
  withActionRecordLock,
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

test('normalizes harmless voice capture filler without semantic rewrite', () => {
  assert.equal(normalizeUtterance('Please, uh, check Puma status.'), 'check puma status');
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

test('classifies deterministic command-owned aliases', () => {
  const commands = [
    {
      command_id: 'local.puma_status',
      example_utterances: ['Check Puma status.'],
      aliases: ['Puma status.', 'Is Puma up?']
    }
  ];

  const command = classifyCommand(commands, 'is puma up');
  assert.equal(command.command_id, 'local.puma_status');
});

test('classifies calibration commands with relaxed deterministic phrases', async () => {
  const contract = await loadCalibrationCommands({ rootDir });
  const command = classifyCalibrationCommand(contract, 'What can you do?');
  const routedCommand = classifyCalibrationCommand(contract, 'Command what can you do?');

  assert.equal(command.command_id, 'commanddeck.help.commands');
  assert.equal(command.route, 'commanddeck.help.commands');
  assert.equal(routedCommand.command_id, 'commanddeck.help.commands');
});

test('answers read-only MVP command from fixture only', async () => {
  const result = await runLocalCommand(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      command_text: 'What is my next SourceGrid task?'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/mvp-commands.cdeck-pack.json'
    }
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

test('answers calibration help before operational command classification', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'what can you do'
    },
    { rootDir, timestamp }
  );

  assert.equal(result.record.command_id, 'commanddeck.help.commands');
  assert.equal(result.record.permission_level, 'read-only');
  assert.equal(result.record.approval_status, 'not_required');
  assert.equal(result.record.route, 'commanddeck.help.commands');
  assert.equal(result.record.result.status, 'answered_calibration_help');
  assert.match(result.response_text, /calibration commands/);
  assert.match(result.response_text, /Active pack/);
  assert.equal(result.record.result.data.active_pack.pack_id, 'commanddeck.core.v1');
  assert.ok(result.record.result.data.forbidden_effects.includes('apprelay_reasoning'));
  assert.deepEqual(result.record.errors, []);
  assert.equal(result.adapter_response.response_mode, 'display_text');
  assert.deepEqual(validateAdapterResponseEnvelope(result.adapter_response), []);
});

test('answers command structure calibration help through Siri platform TTS', async () => {
  const result = await runLocalCommand(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      command_text: 'command structure',
      requested_output: 'spoken_summary'
    },
    { rootDir, timestamp }
  );

  assert.equal(result.record.command_id, 'commanddeck.help.command_structure');
  assert.equal(result.record.approval_status, 'not_required');
  assert.equal(result.adapter_response.response_mode, 'platform_tts');
  assert.match(result.adapter_response.spoken_text, /platform wake phrase/);
  assert.match(result.adapter_response.spoken_text, /computer open ops dashboard activate/);
});

test('Siri request gets platform TTS adapter response without platform reasoning', async () => {
  const result = await runLocalCommand(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      command_text: 'What is my next SourceGrid task?',
      requested_output: 'spoken_summary'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/mvp-commands.cdeck-pack.json'
    }
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
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/mvp-commands.cdeck-pack.json'
    }
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
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/mvp-commands.cdeck-pack.json'
    }
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

test('missing core object returns concept-checking question without routing', async () => {
  const result = await runLocalCommand(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'Computer open activate',
      requested_output: 'spoken_summary',
      request_id: 'siri_session_1'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json'
    }
  );

  assert.equal(result.record.command_id, 'unresolved');
  assert.equal(result.record.route, 'none');
  assert.equal(result.record.result.status, 'needs_clarification');
  assert.equal(result.record.follow_up_owner, 'user');
  assert.equal(result.record.result.clarification.question, 'What should I open?');
  assert.deepEqual(result.record.result.clarification.missing_slots, ['object']);
  assert.equal(result.record.result.clarification.partial_intent.action, 'open');
  assert.equal(result.record.result.clarification.resume_token_status, 'active');
  assert.equal(result.record.result.clarification.workspace_ref, 'sourcegrid');
  assert.equal(result.adapter_response.response_mode, 'platform_tts');
  assert.equal(result.adapter_response.spoken_text, 'What should I open?');
});

test('resumes concept-checking question by filling missing object only', async () => {
  const ccq = await runLocalCommand(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'Computer open activate',
      requested_output: 'spoken_summary',
      request_id: 'siri_session_1'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json'
    }
  );

  const resumed = await resumeConceptCheckingQuestion(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'SourceGrid dashboard',
      requested_output: 'spoken_summary',
      request_id: 'siri_session_1'
    },
    {
      rootDir,
      timestamp: '2026-06-11T00:01:00.000Z',
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json',
      resumeToken: ccq.record.result.clarification.resume_token,
      record: ccq.record
    }
  );

  assert.equal(resumed.resume_status, 'resumed');
  assert.equal(resumed.ccq_record.result.clarification.resume_token_status, 'used');
  assert.equal(resumed.record.command_id, 'local.open_sourcegrid_dashboard');
  assert.equal(resumed.record.approval_status, 'requested_pending');
  assert.equal(resumed.record.result.status, 'approval_requested');
  assert.equal(resumed.adapter_response.response_mode, 'platform_tts');
});

test('pack action requirements ask CCQ but resume must resolve to active pack command', async () => {
  const ccq = await runLocalCommand(
    {
      adapter: 'local_cli',
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'Computer check activate'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json'
    }
  );

  assert.equal(ccq.record.result.status, 'needs_clarification');
  assert.equal(ccq.record.result.clarification.question, 'What should I check?');
  assert.equal(ccq.record.result.clarification.partial_intent.action, 'check');

  const resumed = await resumeConceptCheckingQuestion(
    {
      adapter: 'local_cli',
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'Puma status'
    },
    {
      rootDir,
      timestamp: '2026-06-11T00:01:00.000Z',
      commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json',
      resumeToken: ccq.record.result.clarification.resume_token,
      record: ccq.record,
      executor: async (spec) => {
        assert.equal(spec.command, 'ps');
        assert.deepEqual(spec.args, ['-ef']);
        return {
          exitCode: 0,
          stdout:
            'UID PID PPID C STIME TTY TIME CMD\njimmy 123 1 0 10:00 ?? 0:00.10 puma 6.4.0 (tcp://127.0.0.1:3000)\n',
          stderr: ''
        };
      }
    }
  );

  assert.equal(resumed.resume_status, 'resumed');
  assert.equal(resumed.record.command_id, 'local.puma_status');
  assert.equal(resumed.record.result.status, 'executed_local_exact_command');
  assert.equal(resumed.ccq_record.result.clarification.resume_token_status, 'used');

  const unresolvedCcq = await runLocalCommand(
    {
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'check'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json'
    }
  );
  const unresolved = await resumeConceptCheckingQuestion(
    {
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'Redis status'
    },
    {
      rootDir,
      timestamp: '2026-06-11T00:01:00.000Z',
      commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json',
      resumeToken: unresolvedCcq.record.result.clarification.resume_token,
      record: unresolvedCcq.record
    }
  );

  assert.equal(unresolved.resume_status, 'resumed');
  assert.equal(unresolved.record.command_id, 'unknown');
  assert.equal(unresolved.record.result.status, 'failed_closed');
});

test('rejects duplicate or expired concept-checking resume tokens', async () => {
  const ccq = await runLocalCommand(
    {
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'open'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json'
    }
  );
  const token = ccq.record.result.clarification.resume_token;
  const usedRecord = {
    ...ccq.record,
    result: {
      ...ccq.record.result,
      clarification: {
        ...ccq.record.result.clarification,
        resume_token_status: 'used',
        resume_token_used_at: '2026-06-11T00:01:00.000Z'
      }
    }
  };

  const duplicate = await resumeConceptCheckingQuestion(
    {
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'SourceGrid dashboard'
    },
    {
      rootDir,
      timestamp: '2026-06-11T00:02:00.000Z',
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json',
      resumeToken: token,
      record: usedRecord
    }
  );

  assert.equal(duplicate.resume_status, 'rejected_token_not_active');
  assert.match(duplicate.response_text, /no longer active/);

  const expired = await resumeConceptCheckingQuestion(
    {
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'SourceGrid dashboard'
    },
    {
      rootDir,
      timestamp: '2026-06-11T00:06:00.000Z',
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json',
      resumeToken: token,
      record: ccq.record
    }
  );

  assert.equal(expired.resume_status, 'rejected_token_not_active');
  assert.equal(expired.record.result.clarification.resume_token_status, 'expired');
});

test('rejects concept-checking resume answers that try to change the action', async () => {
  const ccq = await runLocalCommand(
    {
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'open'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json'
    }
  );

  const rejected = await resumeConceptCheckingQuestion(
    {
      actor_ref: 'director',
      workspace_ref: 'sourcegrid',
      command_text: 'actually start Puma'
    },
    {
      rootDir,
      timestamp: '2026-06-11T00:01:00.000Z',
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json',
      resumeToken: ccq.record.result.clarification.resume_token,
      record: ccq.record
    }
  );

  assert.equal(rejected.resume_status, 'rejected_rewrite');
  assert.equal(rejected.record.result.clarification.resume_token_status, 'rejected');
  assert.match(rejected.response_text, /changed the unresolved command/);
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
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/mvp-commands.cdeck-pack.json'
    }
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

test('action record locks reject fresh locks and clean up stale locks', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'command-deck-locks-'));
  const recordPath = 'records/actions/rec_lock_test.json';
  const resolvedRecordPath = path.join(tempRoot, recordPath);
  await mkdir(path.dirname(resolvedRecordPath), { recursive: true });
  await writeFile(resolvedRecordPath, '{}\n', { flag: 'wx' });
  const lockPath = `${resolvedRecordPath}.lock`;

  await writeFile(lockPath, 'fresh\n', { flag: 'wx' });
  await assert.rejects(
    () => withActionRecordLock(tempRoot, recordPath, async () => 'locked'),
    /locked by another CommandDeck process/
  );

  const staleTime = new Date(Date.now() - 60_000);
  await utimes(lockPath, staleTime, staleTime);
  const result = await withActionRecordLock(tempRoot, recordPath, async () => 'recovered');

  assert.equal(result, 'recovered');
  await assert.rejects(() => stat(lockPath), { code: 'ENOENT' });
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

test('CLI answers calibration help without full operational grammar', () => {
  const output = spawnSync(process.execPath, ['bin/command-deck.mjs', 'help'], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record.command_id, 'commanddeck.help.commands');
  assert.equal(parsed.record.result.status, 'answered_calibration_help');
  assert.match(parsed.response_text, /calibration commands/);
  assert.equal(parsed.record_write.status, 'not_written');
});

test('CLI answers calibration help with Siri command routing word', () => {
  const output = spawnSync(process.execPath, ['bin/command-deck.mjs', 'command help'], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record.command_id, 'commanddeck.help.commands');
  assert.equal(parsed.record.result.status, 'answered_calibration_help');
});

test('opens a command pack and writes recent pack state only when requested', async () => {
  const statePath = `records/actions/recent-packs-helper-${Date.now()}.json`;

  const opened = await openCommandPack({
    rootDir,
    commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json',
    timestamp,
    statePath
  });

  assert.equal(opened.status, 'opened');
  assert.equal(opened.active_pack_policy, 'single_active_pack_per_invocation');
  assert.equal(opened.active_command_pack, 'contracts/commands/local-exact-commands.cdeck-pack.json');
  assert.equal(opened.pack.pack_id, 'commanddeck.local-exact.slice2');
  assert.equal(opened.recent_write.status, 'not_written');
  assert.deepEqual((await loadRecentCommandPacks({ rootDir, statePath })).recent_packs, []);

  const written = await openCommandPack({
    rootDir,
    commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json',
    timestamp,
    writeState: true,
    statePath
  });

  assert.equal(written.recent_write.status, 'written');
  const recent = await loadRecentCommandPacks({ rootDir, statePath });
  assert.equal(recent.active_pack_policy, 'single_active_pack_per_invocation');
  assert.equal(recent.recent_packs.length, 1);
  assert.equal(recent.recent_packs[0].command_pack_path, 'contracts/commands/local-exact-commands.cdeck-pack.json');
});

test('CLI supports pack open and recent surfaces', async () => {
  const stateFile = `records/actions/recent-packs-${Date.now()}.json`;
  const openOutput = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      'pack:open',
      '--command-pack',
      'contracts/commands/local-exact-commands.cdeck-pack.json',
      '--state-file',
      stateFile
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(openOutput.status, 0, openOutput.stderr);
  const opened = JSON.parse(openOutput.stdout);
  assert.equal(opened.status, 'opened');
  assert.equal(opened.recent_write.status, 'not_written');
  await assert.rejects(() => stat(path.join(rootDir, stateFile)), { code: 'ENOENT' });

  const writeOutput = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      'pack:open',
      '--command-pack',
      'contracts/commands/local-exact-commands.cdeck-pack.json',
      '--state-file',
      stateFile,
      '--write-state'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(writeOutput.status, 0, writeOutput.stderr);
  const written = JSON.parse(writeOutput.stdout);
  assert.equal(written.recent_write.status, 'written');

  const recentOutput = spawnSync(
    process.execPath,
    ['bin/command-deck.mjs', 'pack:recent', '--state-file', stateFile],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(recentOutput.status, 0, recentOutput.stderr);
  const recent = JSON.parse(recentOutput.stdout);
  assert.equal(recent.recent_packs.length, 1);
  assert.equal(recent.recent_packs[0].pack_id, 'commanddeck.local-exact.slice2');
});

test('initializes a custom command pack layout with safe defaults', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'command-deck-pack-init-'));

  const initialized = await initCommandPack({
    rootDir,
    controlRoot: tempRoot,
    packSlug: 'sourcegrid',
    owner: 'sourcegrid'
  });

  assert.equal(initialized.status, 'initialized');
  assert.equal(initialized.selector_pack_path, 'command-packs/sourcegrid/sourcegrid.cdeck-pack.json');
  assert.equal(initialized.execution_enabled, false);

  const manifest = JSON.parse(await readFile(initialized.manifest_path, 'utf8'));
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  assert.equal(manifest.pack_id, 'sourcegrid.sourcegrid');
  assert.equal(manifest.pack_release, 'release-0.1.0');
  assert.equal(manifest.pack_scope, 'user_custom');
  assert.deepEqual(manifest.commanddeck_release_compatibility, {
    min: 'release-0.1.0',
    max_exclusive: 'release-1.0.0'
  });
  assert.equal(manifest.commands[0].permission_level, 'read-only');
  assert.deepEqual(validateCommandPack(manifest, { routes, permissions }), []);

  await assert.rejects(
    () =>
      initCommandPack({
        rootDir,
        controlRoot: tempRoot,
        packSlug: 'sourcegrid',
        owner: 'sourcegrid'
      }),
    /refuses to overwrite existing file/
  );
});

test('CLI initializes a custom command pack layout', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'command-deck-pack-init-cli-'));
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      'pack:init',
      '--control-root',
      tempRoot,
      '--pack-slug',
      'jimmy-local',
      '--owner',
      'jimmy'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const initialized = JSON.parse(output.stdout);
  assert.equal(initialized.selector_pack_path, 'command-packs/jimmy-local/jimmy-local.cdeck-pack.json');

  const manifest = JSON.parse(await readFile(initialized.manifest_path, 'utf8'));
  assert.equal(manifest.pack_id, 'jimmy.jimmy-local');
  assert.equal(manifest.pack_release, 'release-0.1.0');
  assert.equal(manifest.pack_scope, 'user_custom');
});

test('applies a SourceGrid pack selection after local control-root validation', async () => {
  const selection = await loadSourceGridPackSelection({
    rootDir,
    selectionPath: 'evals/fixtures/pack_selections/local-exact.selection.json'
  });
  const config = await loadCommandDeckConfig({
    rootDir,
    configPath: 'evals/fixtures/pack_discovery/local-control-folder.config.json'
  });
  const statePath = `records/actions/recent-selection-${Date.now()}.json`;

  const applied = await applySourceGridPackSelection(selection, {
    rootDir,
    config,
    timestamp,
    statePath,
    writeState: true
  });

  assert.equal(applied.status, 'applied');
  assert.equal(applied.bridge_mode, 'pull_then_local_validate');
  assert.equal(applied.workspace_ref, 'workspace_sourcegrid_fixture');
  assert.equal(applied.pack_ref, 'commanddeck.local-exact.slice2');
  assert.equal(applied.active_command_pack, 'contracts/commands/local-exact-commands.cdeck-pack.json');
  assert.equal(applied.opened_pack.pack.pack_id, 'commanddeck.local-exact.slice2');
  assert.equal(applied.opened_pack.recent_write.status, 'written');
});

test('applies a pack selection from an external local-only control folder', async () => {
  const externalRoot = await mkdtemp(path.join(os.tmpdir(), 'command-deck-external-packs-'));
  const controlRoot = path.join(externalRoot, 'sourcegrid-labs');
  const packDir = path.join(controlRoot, 'command-packs', 'sourcegrid');
  const packFile = path.join(packDir, 'sourcegrid.cdeck-pack.json');
  const packContents = await readFile(
    path.join(rootDir, 'contracts/commands/local-exact-commands.cdeck-pack.json'),
    'utf8'
  );
  await mkdir(packDir, { recursive: true });
  await writeFile(packFile, packContents);

  const config = {
    schema_version: '0.1',
    default_command_pack: 'contracts/commands/mvp-commands.cdeck-pack.json',
    default_record_dir: 'records/actions',
    default_write_records: false,
    command_pack_roots: [
      {
        id: 'sourcegrid_labs_local',
        kind: 'local-folder',
        path: controlRoot,
        local_only: true,
        enabled: true,
        discovery_mode: 'metadata_only'
      }
    ]
  };
  const selection = {
    schema_version: '0.1',
    contract_kind: 'sourcegrid-pack-selection',
    workspace_ref: 'workspace_sourcegrid_fixture',
    actor_ref: 'director',
    pack_ref: 'commanddeck.local-exact.slice2',
    pack_source_kind: 'local-folder',
    control_root_ref: 'sourcegrid_labs_local',
    pack_path: 'command-packs/sourcegrid/sourcegrid.cdeck-pack.json',
    selected_at: '2026-06-11T00:00:00.000Z'
  };

  assert.deepEqual(validateCommandDeckConfig(config, { rootDir }), []);

  const applied = await applySourceGridPackSelection(selection, {
    rootDir,
    config,
    timestamp
  });

  assert.equal(applied.status, 'applied');
  assert.equal(
    applied.active_command_pack,
    'control-root:sourcegrid_labs_local/command-packs/sourcegrid/sourcegrid.cdeck-pack.json'
  );
  assert.equal(applied.resolved_command_pack_path, packFile);
  assert.equal(applied.opened_pack.pack.pack_id, 'commanddeck.local-exact.slice2');
  assert.equal(applied.opened_pack.recent_entry.command_pack_path, applied.active_command_pack);
  assert.equal(applied.opened_pack.recent_entry.resolved_command_pack_path, packFile);

  await assert.rejects(
    () =>
      applySourceGridPackSelection(
        {
          ...selection,
          pack_path: 'sourcegrid/sourcegrid.cdeck-pack.json'
        },
        {
          rootDir,
          config,
          timestamp
        }
      ),
    /external custom pack path must use command-packs\/<pack_slug>\/<pack_slug>\.cdeck-pack\.json/
  );
});

test('rejects unsafe SourceGrid pack selection manifests', async () => {
  const errors = validateSourceGridPackSelection({
    schema_version: '0.1',
    contract_kind: 'sourcegrid-pack-selection',
    workspace_ref: 'workspace_sourcegrid_fixture',
    actor_ref: 'director',
    pack_ref: 'commanddeck.local-exact.slice2',
    pack_source_kind: 'local-folder',
    control_root_ref: 'local_builtin_control',
    pack_path: '../local-exact-commands.cdeck-pack.json',
    selected_at: '2026-06-11T00:00:00.000Z',
    shell: 'do something'
  });

  assert.ok(errors.includes('selection includes forbidden field shell'));

  const extensionErrors = validateSourceGridPackSelection({
    schema_version: '0.1',
    contract_kind: 'sourcegrid-pack-selection',
    workspace_ref: 'workspace_sourcegrid_fixture',
    actor_ref: 'director',
    pack_ref: 'commanddeck.local-exact.slice2',
    pack_source_kind: 'local-folder',
    control_root_ref: 'local_builtin_control',
    pack_path: 'local-exact-commands.json',
    selected_at: '2026-06-11T00:00:00.000Z'
  });

  assert.ok(extensionErrors.includes('selection pack_path must end with .cdeck-pack.json'));
});

test('CLI applies SourceGrid pack selection without executing the selected pack', async () => {
  const stateFile = `records/actions/recent-selection-cli-${Date.now()}.json`;
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      'pack:apply-selection',
      '--config',
      'evals/fixtures/pack_discovery/local-control-folder.config.json',
      '--selection-file',
      'evals/fixtures/pack_selections/local-exact.selection.json',
      '--state-file',
      stateFile,
      '--write-state'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const applied = JSON.parse(output.stdout);
  assert.equal(applied.status, 'applied');
  assert.equal(applied.active_command_pack, 'contracts/commands/local-exact-commands.cdeck-pack.json');
  assert.equal(applied.opened_pack.recent_write.status, 'written');
});

test('CLI can write and resume a concept-checking question record', async () => {
  const ccqOutput = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      '--command-pack',
      'contracts/commands/local-approved-commands.cdeck-pack.json',
      '--write-record',
      '--record-dir',
      'records/actions',
      'Computer open activate'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(ccqOutput.status, 0, ccqOutput.stderr);
  const ccq = JSON.parse(ccqOutput.stdout);
  assert.equal(ccq.record.result.status, 'needs_clarification');
  assert.equal(ccq.record_write.record_path.startsWith('records/actions/'), true);

  const resumeOutput = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      'ccq:resume',
      '--command-pack',
      'contracts/commands/local-approved-commands.cdeck-pack.json',
      '--record-file',
      ccq.record_write.record_path,
      '--resume-token',
      ccq.record.result.clarification.resume_token,
      '--write-record',
      '--record-dir',
      'records/actions',
      'SourceGrid dashboard'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(resumeOutput.status, 0, resumeOutput.stderr);
  const resumed = JSON.parse(resumeOutput.stdout);
  assert.equal(resumed.resume_status, 'resumed');
  assert.equal(resumed.record.command_id, 'local.open_sourcegrid_dashboard');
  assert.equal(resumed.record.result.status, 'approval_requested');
  assert.equal(resumed.ccq_record.result.clarification.resume_token_status, 'used');
  assert.equal(resumed.ccq_record_write.record_path, ccq.record_write.record_path);
  assert.equal(resumed.record_write.record_path.startsWith('records/actions/'), true);

  const duplicateOutput = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      'ccq:resume',
      '--command-pack',
      'contracts/commands/local-approved-commands.cdeck-pack.json',
      '--record-file',
      ccq.record_write.record_path,
      '--resume-token',
      ccq.record.result.clarification.resume_token,
      'SourceGrid dashboard'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(duplicateOutput.status, 0, duplicateOutput.stderr);
  const duplicate = JSON.parse(duplicateOutput.stdout);
  assert.equal(duplicate.resume_status, 'rejected_token_not_active');
  assert.match(duplicate.response_text, /no longer active/);
});

test('loads the default command pack through validation', async () => {
  const pack = await loadCommandPack({ rootDir });

  assert.equal(pack.pack_id, 'commanddeck.core.v1');
  assert.equal(pack.commands.length, 7);
  assert.equal(pack.targets[0].target_id, 'sourcegrid.dashboard.prod');
});

test('loads a target-only custom pack for core action object slots', async () => {
  const pack = await loadCommandPack({
    rootDir,
    commandPackPath: 'evals/fixtures/command-packs/sourcecombatives/sourcecombatives.cdeck-pack.json'
  });

  assert.equal(pack.pack_id, 'sourcecombatives.targets.v1');
  assert.equal(pack.commands.length, 0);
  assert.equal(pack.default_environment, 'prod');
  assert.deepEqual(
    pack.targets.map((target) => target.target_id),
    ['sourcecombatives.homepage.dev', 'sourcecombatives.homepage.prod']
  );
});

test('loads core action requirements as the CCQ source of truth', async () => {
  const requirements = await loadCoreActionRequirements({ rootDir });

  assert.equal(requirements.get('open').missing_required_slot_ccq, 'What should I open?');
  assert.equal(requirements.get('start').capability_source, 'core');
  assert.equal(requirements.get('start').required_slots.includes('object'), true);
});

test('rejects invalid core action requirements', () => {
  const errors = validateCoreActionRequirements({
    contract_kind: 'action-requirements',
    owner: 'command-deck',
    actions: [
      {
        action: 'open',
        capability_source: 'pack',
        required_slots: ['action'],
        missing_required_slot_ccq: null
      }
    ]
  });

  assert.ok(errors.includes('open capability_source must be core'));
  assert.ok(errors.includes('open required_slots must include object'));
  assert.ok(errors.includes('open missing_required_slot_ccq must be a string'));
  assert.ok(errors.includes('open missing action requirement field allowed_target_kinds'));
});

test('loads the exact local command pack through validation', async () => {
  const pack = await loadCommandPack({
    rootDir,
    commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json'
  });

  assert.equal(pack.pack_id, 'commanddeck.local-exact.slice2');
  assert.equal(pack.commands.length, 4);
});

test('loads the approval-gated local command pack through validation', async () => {
  const pack = await loadCommandPack({
    rootDir,
    commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json'
  });

  assert.equal(pack.pack_id, 'commanddeck.local-approved.slice2');
  assert.equal(pack.commands.length, 2);
});

test('runs with an explicit repo-relative command pack path', async () => {
  const config = await loadCommandDeckConfig({
    rootDir,
    configPath: 'commanddeck.config.example.json'
  });
  const result = await runLocalCommand(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'director',
      surface_hint: 'phone',
      device_code: 'computer',
      command_text: 'What changed in AppRelay today?'
    },
    {
      rootDir,
      timestamp,
      config,
      commandPackPath: 'contracts/commands/mvp-commands.cdeck-pack.json'
    }
  );

  assert.equal(result.record.command_id, 'mvp.apprelay_changes_today');
  assert.equal(result.record.result.data.real_apprelay_read, false);
  assert.equal(
    result.record.result.data.sourcegrid_apprelay_proxy_smoke.network_call_status,
    'not_sent_contract_only'
  );
  assert.equal(
    result.record.result.data.sourcegrid_apprelay_proxy_smoke.endpoint.path,
    '/commanddeck/apprelay/reasoning'
  );
  assert.deepEqual(result.record.result.data.sourcegrid_apprelay_proxy_smoke.validation.errors, []);
  assert.equal(
    result.record.result.data.sourcegrid_apprelay_proxy_smoke.request.required_output_schema.kind,
    'json_schema_ref'
  );
  assert.equal(
    result.record.result.data.sourcegrid_apprelay_proxy_smoke.request.required_output_schema.ref,
    'contracts/apprelay/commanddeck-reasoning-response.schema.json'
  );
  assert.equal(
    result.record.result.data.sourcegrid_apprelay_proxy_smoke.request.user_utterance.text,
    'What changed in AppRelay today?'
  );
});

test('executes an allowlisted local repo status command with an injected executor', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'What is the status of this repo?'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json',
      executor: async (spec) => {
        assert.equal(spec.command, 'git');
        assert.deepEqual(spec.args, ['status', '--short', '--branch']);
        assert.equal(spec.cwd, rootDir);
        return {
          exitCode: 0,
          stdout: '## main...origin/main [ahead 2]\n M README.md\n?? contracts/commands/local-exact-commands.cdeck-pack.json\n',
          stderr: ''
        };
      }
    }
  );

  assert.equal(result.record.command_id, 'local.repo_status');
  assert.equal(result.record.action_key, 'repo.status');
  assert.equal(result.record.result.status, 'executed_local_exact_command');
  assert.equal(result.record.approval_status, 'not_required');
  assert.equal(result.record.sources_used[0], 'local://git/status');
  assert.match(result.response_text, /Repo status: main\.\.\.origin\/main \[ahead 2\]; 2 local file changes\./);
  assert.deepEqual(result.record.result.data.changed_entries, [' M README.md', '?? contracts/commands/local-exact-commands.cdeck-pack.json']);
});

test('executes an allowlisted local Puma status command with an injected executor', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'Is Puma up?'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json',
      executor: async (spec) => {
        assert.equal(spec.command, 'ps');
        assert.deepEqual(spec.args, ['-ef']);
        return {
          exitCode: 0,
          stdout: [
            'UID PID PPID C STIME TTY TIME CMD',
            'jimmy 111 1 0 10:00 ?? 0:00.10 node bin/command-deck.mjs --command-pack local Check Puma status.',
            'jimmy 112 1 0 10:00 ?? 0:00.10 /Users/jimmy/.codex/computer-use/Codex Computer Use.app turn-ended {"prompt":"Check Puma status"}',
            'jimmy 123 1 0 10:00 ?? 0:00.10 puma 6.4.0 (tcp://127.0.0.1:3000)'
          ].join('\n'),
          stderr: ''
        };
      }
    }
  );

  assert.equal(result.record.command_id, 'local.puma_status');
  assert.equal(result.record.action_key, 'service.puma_status');
  assert.equal(result.record.result.status, 'executed_local_exact_command');
  assert.equal(result.record.result.data.running, true);
  assert.equal(result.record.result.data.process_count, 1);
  assert.deepEqual(result.record.result.data.processes, [
    {
      pid: '123',
      command: 'puma 6.4.0 (tcp://127.0.0.1:3000)'
    }
  ]);
  assert.match(result.response_text, /Puma appears to be running in 1 process\./);
});

test('fails closed when an allowlisted local runner action errors', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'Show recent commits.'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-exact-commands.cdeck-pack.json',
      executor: async () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'git repository missing'
      })
    }
  );

  assert.equal(result.record.command_id, 'local.repo_recent_commits');
  assert.equal(result.record.result.status, 'failed_closed');
  assert.equal(result.record.follow_up_owner, 'human_operator');
  assert.match(result.response_text, /Allowlisted local runner action failed/);
  assert.match(result.response_text, /git repository missing/);
});

test('approval-gated local command requests approval without executing', async () => {
  let executorCalled = false;
  const result = await runLocalCommand(
    {
      command_text: 'Open the SourceGrid dashboard.'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json',
      executor: async () => {
        executorCalled = true;
        throw new Error('should not run');
      }
    }
  );

  assert.equal(executorCalled, false);
  assert.equal(result.record.command_id, 'local.open_sourcegrid_dashboard');
  assert.equal(result.record.action_key, 'workspace.open_sourcegrid_dashboard');
  assert.equal(result.record.approval_status, 'requested_pending');
  assert.equal(result.record.result.status, 'approval_requested');
  assert.deepEqual(result.record.approval_request, {
    target: 'SourceGrid dashboard in the default browser',
    action: 'open the dashboard',
    risk: 'launches a GUI app and may reveal workspace context on screen',
    expected_record: 'action record updated after approval decision'
  });
  assert.match(result.response_text, /Approval is required before open the dashboard\./);
});

test('target aliases fill core open object slots without custom scripts', async () => {
  let executorCalled = false;
  const result = await runLocalCommand(
    {
      command_text: 'Computer open source combatives homepage activate'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'evals/fixtures/command-packs/sourcecombatives/sourcecombatives.cdeck-pack.json',
      executor: async () => {
        executorCalled = true;
        throw new Error('should not run before approval');
      }
    }
  );

  assert.equal(executorCalled, false);
  assert.equal(result.record.command_id, 'core.open_url_target.sourcecombatives.homepage.prod');
  assert.equal(result.record.action_key, 'workspace.open_url');
  assert.equal(result.record.approval_status, 'requested_pending');
  assert.equal(result.record.result.status, 'approval_requested');
  assert.deepEqual(result.record.result.data.resolved_target, {
    target_id: 'sourcecombatives.homepage.prod',
    kind: 'url',
    display_name: 'Source Combatives homepage',
    environment: 'prod',
    value: 'https://sourcecombatives.com/'
  });
  assert.match(result.response_text, /Approval is required before open Source Combatives homepage\./);
});

test('approved target alias command opens the resolved URL only after approval', async () => {
  const pending = await runLocalCommand(
    {
      command_text: 'Computer open source combatives activate'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'evals/fixtures/command-packs/sourcecombatives/sourcecombatives.cdeck-pack.json'
    }
  );
  const decision = {
    decision_id: 'appr_sourcecombatives_homepage',
    record_id: pending.record.record_id,
    actor_ref: 'local_prototype',
    decision: 'approved',
    decided_at: '2026-06-11T00:05:00.000Z',
    reason: 'approved target open',
    scope: {
      target: pending.record.approval_request.target,
      action: pending.record.approval_request.action
    },
    expires_at: '2026-06-11T01:00:00.000Z'
  };

  const result = await applyApprovalDecision(pending.record, decision, {
    now: '2026-06-11T00:10:00.000Z',
    executeApprovedLocalActions: true,
    rootDir,
    executor: async (spec) => {
      assert.equal(spec.command, 'open');
      assert.deepEqual(spec.args, ['https://sourcecombatives.com/']);
      assert.equal(spec.cwd, rootDir);
      return {
        exitCode: 0,
        stdout: '',
        stderr: ''
      };
    }
  });

  assert.equal(result.decision_status, 'approved_executed_local_action');
  assert.equal(result.result.status, 'executed_local_approved_action');
  assert.equal(result.result.data.opened_target, 'https://sourcecombatives.com/');
});

test('shared dev prod target alias defaults only through safe open URL command', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'Computer open source combatives activate'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'evals/fixtures/command-packs/sourcecombatives/sourcecombatives.cdeck-pack.json'
    }
  );

  assert.equal(result.record.command_id, 'core.open_url_target.sourcecombatives.homepage.prod');
  assert.equal(result.record.result.data.resolved_target.target_id, 'sourcecombatives.homepage.prod');
  assert.equal(result.record.result.data.resolved_target.value, 'https://sourcecombatives.com/');
});

test('explicit dev target alias overrides default environment', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'Computer open local source combatives activate'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'evals/fixtures/command-packs/sourcecombatives/sourcecombatives.cdeck-pack.json'
    }
  );

  assert.equal(result.record.command_id, 'core.open_url_target.sourcecombatives.homepage.dev');
  assert.equal(result.record.result.data.resolved_target.target_id, 'sourcecombatives.homepage.dev');
  assert.equal(result.record.result.data.resolved_target.value, 'http://localhost:3000/');
});

test('valid target family ambiguity asks CCQ when no default environment exists', async () => {
  const result = await runLocalCommand(
    {
      command_text: 'Computer open source combatives activate',
      workspace_ref: 'sourcegrid'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'evals/fixtures/command-packs/sourcecombatives/sourcecombatives-no-default.cdeck-pack.json'
    }
  );

  assert.equal(result.record.result.status, 'needs_clarification');
  assert.equal(result.record.result.clarification.partial_intent.action, 'open');
  assert.equal(result.record.result.clarification.partial_intent.object, 'source combatives');
  assert.match(result.record.result.clarification.question, /source combatives dev/);
  assert.match(result.record.result.clarification.question, /source combatives production/);
  assert.deepEqual(
    result.record.result.clarification.choices.map((choice) => choice.target_id),
    ['sourcecombatives.homepage.dev', 'sourcecombatives.homepage.prod']
  );
});

test('target ambiguity CCQ resumes with explicit target alias', async () => {
  const ccq = await runLocalCommand(
    {
      command_text: 'Computer open source combatives activate',
      workspace_ref: 'sourcegrid'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'evals/fixtures/command-packs/sourcecombatives/sourcecombatives-no-default.cdeck-pack.json'
    }
  );
  const resumed = await resumeConceptCheckingQuestion(
    {
      command_text: 'source combatives production',
      workspace_ref: 'sourcegrid'
    },
    {
      rootDir,
      timestamp: '2026-06-11T00:01:00.000Z',
      commandPackPath: 'evals/fixtures/command-packs/sourcecombatives/sourcecombatives-no-default.cdeck-pack.json',
      resumeToken: ccq.record.result.clarification.resume_token,
      record: ccq.record
    }
  );

  assert.equal(resumed.resume_status, 'resumed');
  assert.equal(resumed.record.command_id, 'core.open_url_target.sourcecombatives.homepage.prod');
  assert.equal(resumed.record.result.status, 'approval_requested');
  assert.equal(resumed.record.result.data.resolved_target.target_id, 'sourcecombatives.homepage.prod');
  assert.equal(resumed.ccq_record.result.clarification.resume_token_status, 'used');
});

test('rejects shared target aliases without an explicit default environment', async () => {
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const pack = await readJson('evals/fixtures/command-packs/sourcecombatives/sourcecombatives.cdeck-pack.json');
  const unsafePack = structuredClone(pack);
  delete unsafePack.default_environment;

  const errors = validateCommandPack(unsafePack, { routes, permissions });

  assert.ok(errors.some((error) => error.includes('shared target aliases require default_environment')));
});

test('rejects command packs outside the CommandDeck release compatibility range', async () => {
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const pack = await readJson('contracts/commands/core-commands.cdeck-pack.json');

  const futurePack = structuredClone(pack);
  futurePack.commanddeck_release_compatibility = {
    min: 'release-0.2.0',
    max_exclusive: 'release-1.0.0'
  };

  const expiredPack = structuredClone(pack);
  expiredPack.commanddeck_release_compatibility = {
    min: 'release-0.0.1',
    max_exclusive: 'release-0.1.0'
  };

  const invalidRangePack = structuredClone(pack);
  invalidRangePack.commanddeck_release_compatibility = {
    min: 'release-1.0.0',
    max_exclusive: 'release-1.0.0'
  };

  assert.ok(
    validateCommandPack(futurePack, { routes, permissions }).some((error) =>
      error.includes('commanddeck release release-0.1.0 is outside pack compatibility range release-0.2.0 <= release < release-1.0.0')
    )
  );
  assert.ok(
    validateCommandPack(expiredPack, { routes, permissions }).some((error) =>
      error.includes('commanddeck release release-0.1.0 is outside pack compatibility range release-0.0.1 <= release < release-0.1.0')
    )
  );
  assert.ok(
    validateCommandPack(invalidRangePack, { routes, permissions }).includes(
      'commanddeck_release_compatibility.min must be lower than max_exclusive'
    )
  );
});

test('rejects command packs with executable fields or unsafe sources', async () => {
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const pack = await readJson('contracts/commands/mvp-commands.cdeck-pack.json');
  const unsafePack = structuredClone(pack);

  unsafePack.commands[0].script = './do-real-work.sh';
  unsafePack.commands[0].sources = ['../sourcegrid-labs/private.json'];

  const errors = validateCommandPack(unsafePack, { routes, permissions });
  assert.ok(errors.some((error) => error.includes('forbidden executable field script')));
  assert.ok(errors.some((error) => error.includes('source must be repo-relative under evals/fixtures')));
});

test('rejects command packs with conflicting normalized aliases', async () => {
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const pack = await readJson('contracts/commands/local-exact-commands.cdeck-pack.json');
  const invalidPack = structuredClone(pack);

  invalidPack.commands[0].aliases = ['Check server.'];
  invalidPack.commands[1].aliases = ['Please check server.'];

  const errors = validateCommandPack(invalidPack, { routes, permissions });
  assert.ok(errors.some((error) => error.includes('conflicts with local.repo_status aliases[0]: check server')));
});

test('writes opt-in pack rejection audit records for invalid custom packs', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'command-deck-pack-audit-'));
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const pack = await readJson('contracts/commands/mvp-commands.cdeck-pack.json');
  const unsafePack = structuredClone(pack);
  const packPath = 'packs/unsafe.cdeck-pack.json';
  const auditDir = 'records/pack-rejections';

  unsafePack.commands[0].shell = 'do-not-store-script-contents';
  unsafePack.commands[0].sources = ['https://example.test/private.json?token=abc123'];

  await mkdir(path.join(tempRoot, 'packs'), { recursive: true });
  await writeFile(path.join(tempRoot, packPath), `${JSON.stringify(unsafePack, null, 2)}\n`);

  await assert.rejects(
    () =>
      loadCommandPack({
        rootDir: tempRoot,
        commandPackPath: packPath,
        routes,
        permissions,
        writeAudit: true,
        auditDir,
        timestamp
      }),
    /audit written to records\/pack-rejections/
  );

  const auditFiles = await readdir(path.join(tempRoot, auditDir));
  assert.equal(auditFiles.length, 1);

  const audit = JSON.parse(await readFile(path.join(tempRoot, auditDir, auditFiles[0]), 'utf8'));
  assert.equal(audit.event, 'pack_command_rejected');
  assert.equal(audit.rejection_phase, 'pack_load');
  assert.equal(audit.reason, 'invalid_command_pack');
  assert.equal(audit.command_pack_path, packPath);
  assert.equal(audit.pack_id, unsafePack.pack_id);
  assert.ok(audit.command_ids.includes(unsafePack.commands[0].command_id));
  assert.ok(audit.errors.some((error) => error.includes('forbidden executable field shell')));
  assert.ok(audit.errors.some((error) => error.includes('token=[REDACTED]')));
  assert.equal(JSON.stringify(audit).includes('abc123'), false);
  assert.equal(JSON.stringify(audit).includes('do-not-store-script-contents'), false);
});

test('rejects invalid pack action requirements', async () => {
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const pack = await readJson('contracts/commands/local-exact-commands.cdeck-pack.json');
  const invalidPack = structuredClone(pack);

  invalidPack.action_requirements = [
    {
      action: 'check',
      capability_source: 'core',
      required_slots: ['action'],
      optional_slots: [],
      allowed_target_kinds: ['service'],
      defaulting_rules: [],
      risk_tier: 'informational',
      approval_may_be_required: false,
      missing_required_slot_ccq: ''
    }
  ];

  const errors = validateCommandPack(invalidPack, { routes, permissions });
  assert.ok(errors.includes('check capability_source must be pack'));
  assert.ok(errors.includes('check required_slots must include object'));
  assert.ok(errors.includes('check missing_required_slot_ccq must be a string'));
});

test('command pack paths must stay inside the repo', async () => {
  await assert.rejects(
    () =>
      loadCommandPack({
        rootDir,
        commandPackPath: '/tmp/not-a-command-pack.cdeck-pack.json'
      }),
    /repo-relative/
  );

  await assert.rejects(
    () =>
      loadCommandPack({
        rootDir,
        commandPackPath: '../outside-command-deck.cdeck-pack.json'
      }),
    /inside the repo/
  );

  await assert.rejects(
    () =>
      loadCommandPack({
        rootDir,
        commandPackPath: 'contracts/commands/not-a-pack.json'
      }),
    /command pack manifest path must end with \.cdeck-pack\.json/
  );
});

test('CLI accepts an explicit command pack without writing records', async () => {
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      '--command-pack',
      'contracts/commands/mvp-commands.cdeck-pack.json',
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

test('CLI can execute an exact local repo status pack without writing records', async () => {
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      '--command-pack',
      'contracts/commands/local-exact-commands.cdeck-pack.json',
      'What is the status of this repo?'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record.command_id, 'local.repo_status');
  assert.equal(parsed.record.action_key, 'repo.status');
  assert.equal(parsed.record.result.status, 'executed_local_exact_command');
  assert.equal(parsed.record_write.status, 'not_written');
});

test('CLI can apply an approval decision and report the current decision status', async () => {
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      'approval:apply',
      '--record-file',
      'evals/fixtures/action_records/operatorkit_dry_run.blocked.json',
      '--decision-file',
      'evals/fixtures/approval_decisions/operatorkit_dry_run.expired.json'
    ],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.decision_status, 'rejected_expired');
  assert.equal(parsed.approval_status, 'blocked_execute_now_disabled');
  assert.equal(parsed.record_write.status, 'not_written');
});

test('uses safe config defaults when no local config file exists', async () => {
  const config = await loadCommandDeckConfig({ rootDir });

  assert.equal(config.config_path, null);
  assert.equal(config.default_command_pack, 'contracts/commands/core-commands.cdeck-pack.json');
  assert.equal(config.default_record_dir, 'records/actions');
  assert.equal(config.default_write_records, false);

  const activePack = buildActiveCommandPackStatus(config);
  assert.equal(activePack.active_command_pack, 'contracts/commands/core-commands.cdeck-pack.json');
  assert.equal(activePack.active_pack_policy, 'single_active_pack_per_invocation');
  assert.equal(activePack.discovery_roots_configured, 0);
  assert.equal(activePack.discovery_roots_active_for_routing, false);
});

test('loads the explicit example config', async () => {
  const config = await loadCommandDeckConfig({
    rootDir,
    configPath: 'commanddeck.config.example.json'
  });

  assert.equal(config.config_path, 'commanddeck.config.example.json');
  assert.equal(config.default_command_pack, 'contracts/commands/core-commands.cdeck-pack.json');
  assert.equal(config.default_write_records, false);
  assert.equal(config.command_pack_roots[0].discovery_mode, 'metadata_only');
  assert.equal(config.command_pack_roots[1].repo_slug, 'sourcegrid-labs');
  assert.equal(config.sourcegrid_attachment.billing_owner, 'sourcegrid_workspace');
  assert.equal(config.sourcegrid_attachment.payment_method_state, 'missing');
  assert.equal(config.sourcegrid_attachment.command_pack_owner_repos[0], 'sourcegrid-labs');

  const activePack = buildActiveCommandPackStatus(config);
  assert.equal(activePack.active_command_pack, 'contracts/commands/core-commands.cdeck-pack.json');
  assert.equal(activePack.active_pack_source_field, 'default_command_pack');
  assert.equal(activePack.active_pack_policy, 'single_active_pack_per_invocation');
  assert.equal(activePack.discovery_roots_configured, 3);
  assert.equal(activePack.discovery_roots_role, 'available_pack_locations_only');
  assert.equal(activePack.discovery_roots_active_for_routing, false);
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

test('builds SourceGrid AppRelay proxy request preview without network dispatch', async () => {
  const config = await loadCommandDeckConfig({
    rootDir,
    configPath: 'commanddeck.config.example.json'
  });
  const preview = buildSourceGridAppRelayProxyRequest(
    {
      adapter: 'apple_shortcuts',
      actor_ref: 'user_sourcegrid_fixture',
      surface_hint: 'phone',
      device_code: 'command',
      command_text: "Computer summarize today's AppRelay changes activate",
      requested_output: 'display_text'
    },
    {
      config,
      timestamp,
      requestId: 'sgarp_req_fixture',
      idempotencyKey: 'sgarp_idem_fixture',
      activePackDigest: 'fixture-pack-digest',
      controlFolderDigest: 'fixture-control-folder-digest'
    }
  );

  assert.equal(preview.contract_kind, 'commanddeck-sourcegrid-apprelay-proxy-client-preview');
  assert.equal(preview.endpoint.path, '/commanddeck/apprelay/reasoning');
  assert.equal(preview.network_call_status, 'not_sent_contract_only');
  assert.equal(preview.sourcegrid_contract_status, 'guarded_sourcegrid_dev_dispatch_enabled');
  assert.deepEqual(preview.validation.errors, []);
  assert.equal(preview.request.request_identity.client_key, 'commanddeck');
  assert.equal(preview.request.request_identity.runtime_mode, 'sourcegrid_prod');
  assert.equal(preview.request.sourcegrid_attachment_ref.sourcegrid_workspace_ref, 'workspace_sourcegrid_fixture');
  assert.equal(preview.request.sourcegrid_attachment_ref.sourcegrid_user_ref, 'user_sourcegrid_fixture');
  assert.equal(preview.request.sourcegrid_attachment_ref.attachment_issued_at, '2026-06-13T00:00:00.000Z');
  assert.equal(preview.request.sourcegrid_attachment_ref.attachment_expires_at, '2026-06-13T00:05:00.000Z');
  assert.equal(preview.request.active_local_context.pack_ref, 'contracts/commands/core-commands.cdeck-pack.json');
  assert.equal(preview.request.active_local_context.commanddeck_version, 'release-0.1.0');
  assert.equal(preview.request.authority_constraints.no_execution_authority, true);
  assert.equal(preview.request.authority_constraints.no_memory_activation, true);
  assert.equal(preview.request.runtime_task.route_work_type, 'commanddeck.command_routing_reasoning.standard');
  assert.equal(preview.request.required_output_schema.kind, 'json_schema_ref');
  assert.equal(preview.request.required_output_schema.ref, 'contracts/apprelay/commanddeck-reasoning-response.schema.json');
  assert.equal(preview.request.user_utterance.text, "Computer summarize today's AppRelay changes activate");
  assert.equal(preview.request.user_utterance.locale, 'en-US');
});

test('rejects SourceGrid AppRelay proxy request provider/model aliases', async () => {
  const fixture = await readJson('evals/fixtures/sourcegrid_proxy/apprelay_reasoning.request.json');
  const poisoned = {
    ...fixture,
    runtime_task: {
      ...fixture.runtime_task,
      model_key: 'not-allowed'
    },
    active_local_context: {
      ...fixture.active_local_context,
      provider_model: 'not-allowed'
    },
    nested: {
      apprelay_token: 'not-allowed'
    }
  };
  const errors = validateSourceGridAppRelayProxyRequest(poisoned);

  assert.ok(errors.some((error) => error.includes('runtime_task.model_key')));
  assert.ok(errors.some((error) => error.includes('active_local_context.provider_model')));
  assert.ok(errors.some((error) => error.includes('nested.apprelay_token')));
});

test('validates SourceGrid AppRelay proxy internal dev request fixture', async () => {
  const fixture = await readJson('evals/fixtures/sourcegrid_proxy/apprelay_reasoning.dev.request.json');

  assert.deepEqual(validateSourceGridAppRelayProxyRequest(fixture), []);
  assert.equal(fixture.request_identity.runtime_mode, 'sourcegrid_dev');
  assert.equal(fixture.active_local_context.commanddeck_version, 'release-0.1.0');
  assert.equal(fixture.internal_actor_ref, 'sourcegrid-internal:user_sourcegrid_fixture');
  assert.equal(fixture.internal_dev_reason, 'local CommandDeck AppRelay runtime smoke');
  assert.equal(fixture.runtime_task.cost_class, 'sourcegrid_company_dev_budget');
  assert.equal(fixture.authority_constraints.no_execution_authority, true);
  assert.equal(fixture.authority_constraints.no_memory_activation, true);
});

test('builds SourceGrid AppRelay proxy internal dev preview without sending network request', () => {
  const config = {
    sourcegrid_attachment: {
      sourcegrid_workspace_ref: 'workspace_sourcegrid_fixture',
      sourcegrid_account_ref: 'account_sourcegrid_fixture',
      attachment_issued_at: '2026-06-13T00:00:00.000Z',
      attachment_expires_at: '2026-06-13T00:05:00.000Z'
    },
    default_command_pack: 'contracts/commands/core-commands.cdeck-pack.json'
  };
  const preview = buildSourceGridAppRelayProxyRequest(
    {
      adapter: 'local_cli',
      actor_ref: 'user_sourcegrid_fixture',
      surface_hint: 'computer',
      device_code: 'command',
      command_text: "Computer summarize today's AppRelay changes activate",
      runtime_mode: 'sourcegrid_dev',
      internal_actor_ref: 'sourcegrid-internal:user_sourcegrid_fixture',
      internal_dev_reason: 'local CommandDeck AppRelay runtime smoke'
    },
    {
      config,
      timestamp,
      requestId: 'sgarp_internal_dev_req_fixture',
      idempotencyKey: 'sgarp_internal_dev_idem_fixture',
      activePackDigest: 'fixture-pack-digest',
      controlFolderDigest: 'fixture-control-folder-digest'
    }
  );

  assert.equal(preview.network_call_status, 'not_sent_contract_only');
  assert.deepEqual(preview.validation.errors, []);
  assert.equal(preview.request.request_identity.runtime_mode, 'sourcegrid_dev');
  assert.equal(preview.request.active_local_context.commanddeck_version, 'release-0.1.0');
  assert.equal(preview.request.internal_actor_ref, 'sourcegrid-internal:user_sourcegrid_fixture');
  assert.equal(preview.request.internal_dev_reason, 'local CommandDeck AppRelay runtime smoke');
  assert.equal(preview.request.runtime_task.cost_class, 'sourcegrid_company_dev_budget');
});

test('rejects SourceGrid AppRelay proxy internal dev request missing dev identity', async () => {
  const fixture = await readJson('evals/fixtures/sourcegrid_proxy/apprelay_reasoning.dev.request.json');
  const invalid = { ...fixture };
  delete invalid.internal_actor_ref;
  delete invalid.internal_dev_reason;

  const errors = validateSourceGridAppRelayProxyRequest(invalid);

  assert.ok(errors.some((error) => error.includes('internal_actor_ref is required')));
  assert.ok(errors.some((error) => error.includes('internal_dev_reason is required')));
});

test('maps SourceGrid AppRelay proxy blocked response into fail-closed user response', async () => {
  const response = await readJson('evals/fixtures/sourcegrid_proxy/apprelay_reasoning.blocked_spend.response.json');

  assert.deepEqual(validateSourceGridAppRelayProxyResponse(response), []);

  const mapped = buildCommandDeckResponseForSourceGridProxyResponse(response);

  assert.equal(mapped.status, 'blocked_apprelay_spend_unavailable');
  assert.equal(mapped.response_text, response.user_message);
  assert.equal(mapped.retryable, false);
  assert.deepEqual(mapped.errors, []);
});

test('maps SourceGrid AppRelay proxy ok response into revalidation-required response', async () => {
  const response = await readJson('evals/fixtures/sourcegrid_proxy/apprelay_reasoning.ok.response.json');

  assert.deepEqual(validateSourceGridAppRelayProxyResponse(response), []);

  const mapped = buildCommandDeckResponseForSourceGridProxyResponse(response);

  assert.equal(mapped.status, 'ok');
  assert.match(mapped.response_text, /revalidate before routing/);
  assert.equal(mapped.apprelay_response.command_id, 'mvp.apprelay_changes_today');
  assert.deepEqual(mapped.errors, []);
});

test('CLI prints SourceGrid AppRelay proxy preview without sending network request', () => {
  const output = spawnSync(
    process.execPath,
    [
      'bin/command-deck.mjs',
      'sourcegrid:apprelay-proxy-preview',
      '--config',
      'commanddeck.config.example.json',
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
  assert.equal(parsed.endpoint.path, '/commanddeck/apprelay/reasoning');
  assert.equal(parsed.network_call_status, 'not_sent_contract_only');
  assert.equal(parsed.request.request_identity.client_key, 'commanddeck');
  assert.equal(parsed.request.sourcegrid_attachment_ref.sourcegrid_workspace_ref, 'workspace_sourcegrid_fixture');
  assert.equal(parsed.request.active_local_context.pack_ref, 'contracts/commands/core-commands.cdeck-pack.json');
  assert.equal(parsed.request.required_output_schema.ref, 'contracts/apprelay/commanddeck-reasoning-response.schema.json');
  assert.equal(parsed.request.user_utterance.text, 'What is my next SourceGrid task?');
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
  assert.ok(errors.some((error) => error.includes('default_command_pack must end with .cdeck-pack.json')));
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
    ['bin/command-deck.mjs', '--config', 'commanddeck.config.example.json', 'Git status.'],
    {
      cwd: rootDir,
      encoding: 'utf8'
    }
  );

  assert.equal(output.status, 0, output.stderr);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.record.command_id, 'core.repo_status');
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
  assert.equal(request.device_code, 'computer');
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
  assert.equal(request.device_code, 'computer');
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
      '--command-pack',
      'contracts/commands/mvp-commands.cdeck-pack.json',
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
      '--command-pack',
      'contracts/commands/mvp-commands.cdeck-pack.json',
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
  const result = await applyApprovalDecision(record, decision, {
    now: '2026-06-11T00:10:00.000Z'
  });

  assert.equal(result.decision_status, 'denied_no_execution');
  assert.equal(result.approval_status, 'denied');
  assert.equal(result.result.status, 'blocked_contract_only');
});

test('approved approval decision still cannot execute in Phase 1', async () => {
  const record = await readJson('evals/fixtures/action_records/operatorkit_dry_run.blocked.json');
  const decision = await readJson('evals/fixtures/approval_decisions/operatorkit_dry_run.approved.json');
  const result = await applyApprovalDecision(record, decision, {
    now: '2026-06-11T00:10:00.000Z'
  });

  assert.equal(result.decision_status, 'approved_execution_disabled');
  assert.equal(result.approval_status, 'approved');
  assert.equal(result.result.status, 'blocked_contract_only');
});

test('expired approval decision is rejected', async () => {
  const record = await readJson('evals/fixtures/action_records/operatorkit_dry_run.blocked.json');
  const decision = await readJson('evals/fixtures/approval_decisions/operatorkit_dry_run.expired.json');
  const result = await applyApprovalDecision(record, decision, {
    now: '2026-06-11T00:10:00.000Z'
  });

  assert.equal(result.decision_status, 'rejected_expired');
  assert.ok(result.errors.includes('approval decision is expired'));
});

test('approved local action decision executes allowlisted action when enabled', async () => {
  const pending = await runLocalCommand(
    {
      actor_ref: 'director',
      command_text: 'Open the CommandDeck repo.'
    },
    {
      rootDir,
      timestamp,
      commandPackPath: 'contracts/commands/local-approved-commands.cdeck-pack.json'
    }
  );
  const decision = {
    decision_id: 'appr_local_repo_open',
    record_id: pending.record.record_id,
    actor_ref: 'director',
    decision: 'approved',
    decided_at: '2026-06-11T00:05:00.000Z',
    reason: 'approved for local desktop use',
    scope: {
      target: pending.record.approval_request.target,
      action: pending.record.approval_request.action
    },
    expires_at: '2026-06-11T01:00:00.000Z'
  };

  const result = await applyApprovalDecision(pending.record, decision, {
    now: '2026-06-11T00:10:00.000Z',
    executeApprovedLocalActions: true,
    rootDir,
    executor: async (spec) => {
      assert.equal(spec.command, 'open');
      assert.deepEqual(spec.args, ['.']);
      assert.equal(spec.cwd, rootDir);
      return {
        exitCode: 0,
        stdout: '',
        stderr: ''
      };
    }
  });

  assert.equal(result.decision_status, 'approved_executed_local_action');
  assert.equal(result.approval_status, 'approved');
  assert.equal(result.result.status, 'executed_local_approved_action');
  assert.equal(result.record.action_key, 'workspace.open_commanddeck_repo');
  assert.equal(result.record.follow_up_owner, null);
  assert.match(result.result.summary, /Opened the current CommandDeck repo\./);
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
