import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const smokeId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const cleanupPaths = [];
const results = [];

try {
  smokeCommand('repo status', ['What is the status of this repo?'], (result) => {
    assert.equal(result.record.command_id, 'core.repo_status');
    assert.equal(result.record.route, 'local.exact_read');
    assert.equal(result.record.result.status, 'executed_local_exact_command');
    assert.equal(result.record_write.status, 'not_written');
  });

  smokeCommand('recent commits', ['Show recent commits.'], (result) => {
    assert.equal(result.record.command_id, 'core.repo_recent_commits');
    assert.equal(result.record.route, 'local.exact_read');
    assert.equal(result.record.result.status, 'executed_local_exact_command');
    assert.ok(Array.isArray(result.record.result.data.commits));
  });

  smokeCommand('puma status', ['Is Puma running?'], (result) => {
    assert.equal(result.record.command_id, 'core.puma_status');
    assert.equal(result.record.route, 'local.exact_read');
    assert.equal(result.record.result.status, 'executed_local_exact_command');
    assert.equal(result.record.result.data.runner_action, 'service.puma_status');
    assert.equal(typeof result.record.result.data.running, 'boolean');
  });

  smokeCommand('sidekiq status', ['Is Sidekiq running?'], (result) => {
    assert.equal(result.record.command_id, 'core.sidekiq_status');
    assert.equal(result.record.route, 'local.exact_read');
    assert.equal(result.record.result.status, 'executed_local_exact_command');
    assert.equal(result.record.result.data.runner_action, 'service.sidekiq_status');
    assert.equal(typeof result.record.result.data.running, 'boolean');
  });

  smokeCommand('calibration commands help', ['What commands can you understand?'], (result) => {
    assert.equal(result.record.command_id, 'commanddeck.help.commands');
    assert.equal(result.record.route, 'commanddeck.help.commands');
    assert.equal(result.record.result.status, 'answered_calibration_help');
  });

  smokeCommand('calibration command structure', ['What is the command structure?'], (result) => {
    assert.equal(result.record.command_id, 'commanddeck.help.command_structure');
    assert.equal(result.record.route, 'commanddeck.help.command_structure');
    assert.equal(result.record.result.status, 'answered_calibration_help');
  });

  smokeCommand('calibration siri setup', ['Siri setup'], (result) => {
    assert.equal(result.record.command_id, 'commanddeck.help.siri_surface');
    assert.equal(result.record.route, 'commanddeck.help.siri_surface');
    assert.equal(result.record.result.status, 'answered_calibration_help');
  });

  smokeCommand(
    'sourcecombatives pack open',
    [
      'pack:open',
      '--command-pack',
      'evals/fixtures/command-packs/sourcecombatives/sourcecombatives.cdeck-pack.json'
    ],
    (result) => {
      assert.equal(result.status, 'opened');
      assert.equal(result.active_pack_policy, 'single_active_pack_per_invocation');
      assert.equal(result.pack.pack_id, 'sourcecombatives.targets.v1');
      assert.equal(result.recent_write.status, 'not_written');
    }
  );

  smokeCommand(
    'sourcecombatives target alias approval preview',
    [
      '--command-pack',
      'evals/fixtures/command-packs/sourcecombatives/sourcecombatives.cdeck-pack.json',
      'Computer open source combatives activate'
    ],
    (result) => {
      assert.ok(result.record.command_id.startsWith('core.open_url_target.'));
      assert.equal(result.record.route, 'local.exact_control');
      assert.equal(result.record.permission_level, 'approval-required');
      assert.equal(result.record.approval_status, 'requested_pending');
      assert.equal(result.record.result.status, 'approval_requested');
    }
  );

  smokeCommand(
    'adapter request with MVP fixture pack',
    [
      '--command-pack',
      'contracts/commands/mvp-commands.cdeck-pack.json',
      '--request-file',
      'evals/fixtures/adapter_requests/apple_shortcuts.next_task.json'
    ],
    (result) => {
      assert.equal(result.record.command_id, 'mvp.next_sourcegrid_task');
      assert.equal(result.adapter_response.adapter, 'apple_shortcuts');
      assert.equal(result.adapter_response.response_mode, 'platform_tts');
      assert.equal(result.record.result.status, 'answered_from_fixture');
    }
  );

  smokeApprovalDeniedFlow();

  console.log(JSON.stringify({ status: 'passed', total: results.length, checks: results }, null, 2));
} finally {
  for (const cleanupPath of cleanupPaths.reverse()) {
    fs.rmSync(cleanupPath, { force: true });
  }
}

function smokeApprovalDeniedFlow() {
  const recordResult = smokeCommand(
    'approval record write',
    ['--write-record', '--record-dir', 'records/actions', 'Open the CommandDeck repo.'],
    (result) => {
      assert.equal(result.record.command_id, 'core.open_commanddeck_repo');
      assert.equal(result.record.permission_level, 'approval-required');
      assert.equal(result.record.approval_status, 'requested_pending');
      assert.ok(result.record_write.record_path.startsWith('records/actions/'));
    },
    {
      afterRun: (result) => {
        if (result.record_write?.record_path) {
          cleanupPaths.push(path.join(rootDir, result.record_write.record_path));
        }
      }
    }
  );

  const decisionPath = `records/actions/appr_local_smoke_denied_${smokeId}.json`;
  const decisionFullPath = path.join(rootDir, decisionPath);
  cleanupPaths.push(decisionFullPath);

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const decision = {
    decision_id: `appr_local_smoke_denied_${smokeId}`,
    record_id: recordResult.record.record_id,
    actor_ref: recordResult.record.actor_ref,
    decision: 'denied',
    decided_at: new Date().toISOString(),
    reason: 'Local smoke verifies denied approval without executing GUI control.',
    scope: {
      target: recordResult.record.approval_request.target,
      action: recordResult.record.approval_request.action
    },
    expires_at: expiresAt
  };
  fs.writeFileSync(decisionFullPath, `${JSON.stringify(decision, null, 2)}\n`);

  smokeCommand(
    'approval denied apply',
    [
      'approval:apply',
      '--record-file',
      recordResult.record_write.record_path,
      '--decision-file',
      decisionPath,
      '--write-record'
    ],
    (result) => {
      assert.equal(result.decision_status, 'denied_no_execution');
      assert.equal(result.approval_status, 'denied');
      assert.equal(result.record.approval_status, 'denied');
      assert.equal(result.record_write.record_path, recordResult.record_write.record_path);
    }
  );
}

function smokeCommand(name, args, assertResult, options = {}) {
  const output = runCli(args);
  options.afterRun?.(output);
  assertResult(output);
  results.push({ name, status: 'passed' });
  return output;
}

function runCli(args) {
  const child = spawnSync(process.execPath, ['bin/command-deck.mjs', ...args], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  if (child.status !== 0) {
    throw new Error(
      `command-deck ${args.join(' ')} failed with exit ${child.status}\nSTDOUT:\n${child.stdout}\nSTDERR:\n${child.stderr}`
    );
  }

  try {
    return JSON.parse(child.stdout);
  } catch (error) {
    throw new Error(`command-deck ${args.join(' ')} did not return JSON: ${error.message}\n${child.stdout}`);
  }
}
