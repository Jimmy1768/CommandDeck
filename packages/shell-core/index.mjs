import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ACTOR = 'local_prototype';
const DEFAULT_ADAPTER = 'local_cli';

export async function runLocalCommand(input, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const timestamp = options.timestamp ?? new Date().toISOString();
  const pack = await readJson(rootDir, 'contracts/commands/mvp-commands.json');
  const routes = await readJson(rootDir, 'contracts/routes/route-contracts.json');
  const permissions = await readJson(rootDir, 'contracts/permissions/permission-levels.json');

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

export async function writeActionRecord(record, options = {}) {
  const rootDir = options.rootDir ?? path.resolve(import.meta.dirname, '../..');
  const recordDir = resolveRecordDir(rootDir, options.recordDir ?? 'records/actions');
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

async function readJson(rootDir, relativePath) {
  const contents = await readFile(path.join(rootDir, relativePath), 'utf8');
  return JSON.parse(contents);
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
