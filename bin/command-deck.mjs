#!/usr/bin/env node
import process from 'node:process';
import {
  applyApprovalDecision,
  applySourceGridPackSelection,
  buildSourceGridAttachmentStatus,
  loadActionRecord,
  loadAdapterRequest,
  loadApprovalDecision,
  loadCommandDeckConfig,
  loadRecentCommandPacks,
  loadSourceGridPackSelection,
  initCommandPack,
  openCommandPack,
  resumeConceptCheckingQuestionFromFile,
  runLocalCommand,
  writeActionRecord,
  writeActionRecordFile
} from '../packages/shell-core/index.mjs';

const parsed = parseArgs(process.argv.slice(2));
const config = await loadCommandDeckConfig({
  configPath: parsed.config
});

if (['sourcegrid:status', 'attachment:status'].includes(parsed.subcommand)) {
  console.log(JSON.stringify(buildSourceGridAttachmentStatus(config), null, 2));
  process.exit(0);
}

if (parsed.subcommand === 'pack:recent') {
  console.log(
    JSON.stringify(
      await loadRecentCommandPacks({
        statePath: parsed.stateFile
      }),
      null,
      2
    )
  );
  process.exit(0);
}

if (parsed.subcommand === 'pack:open') {
  if (!parsed.commandPack) {
    console.error('Usage error: pack:open requires --command-pack.');
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      await openCommandPack({
        commandPackPath: parsed.commandPack,
        writeState: parsed.writeState,
        statePath: parsed.stateFile
      }),
      null,
      2
    )
  );
  process.exit(0);
}

if (parsed.subcommand === 'pack:init') {
  if (!parsed.packSlug || !parsed.owner) {
    console.error('Usage error: pack:init requires --pack-slug and --owner.');
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      await initCommandPack({
        packSlug: parsed.packSlug,
        owner: parsed.owner,
        controlRoot: parsed.controlRoot
      }),
      null,
      2
    )
  );
  process.exit(0);
}

if (parsed.subcommand === 'pack:apply-selection') {
  if (!parsed.selectionFile) {
    console.error('Usage error: pack:apply-selection requires --selection-file.');
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      await applySourceGridPackSelection(
        await loadSourceGridPackSelection({
          selectionPath: parsed.selectionFile
        }),
        {
          config,
          writeState: parsed.writeState,
          statePath: parsed.stateFile
        }
      ),
      null,
      2
    )
  );
  process.exit(0);
}

if (parsed.subcommand === 'approval:apply') {
  if (!parsed.recordFile || !parsed.decisionFile) {
    console.error('Usage error: approval:apply requires --record-file and --decision-file.');
    process.exit(2);
  }

  const record = await loadActionRecord({
    recordPath: parsed.recordFile
  });
  const decision = await loadApprovalDecision({
    decisionPath: parsed.decisionFile
  });
  const decisionResult = await applyApprovalDecision(record, decision, {
    executeApprovedLocalActions: true
  });

  if (parsed.writeRecord && decisionResult.record) {
    decisionResult.record_write = await writeActionRecordFile(decisionResult.record, {
      recordPath: parsed.recordFile,
      overwrite: true
    });
  } else {
    decisionResult.record_write = {
      status: 'not_written',
      reason: 'updated action record persistence requires --write-record'
    };
  }

  console.log(JSON.stringify(decisionResult, null, 2));
  process.exit(0);
}

if (parsed.subcommand === 'ccq:resume') {
  if (!parsed.recordFile || !parsed.resumeToken) {
    console.error('Usage error: ccq:resume requires --record-file and --resume-token.');
    process.exit(2);
  }

  const adapterRequest = parsed.requestFile
    ? await loadAdapterRequest({
        requestPath: parsed.requestFile
      })
    : null;
  const answerText = parsed.commandText || adapterRequest?.command_text;

  if (parsed.requestFile && parsed.commandText) {
    console.error('Usage error: provide either --request-file or command text, not both.');
    process.exit(2);
  }

  if (!answerText) {
    console.error('Usage error: ccq:resume requires follow-up answer text.');
    process.exit(2);
  }

  const resumeInput = adapterRequest ?? {
    adapter: 'local_cli',
    actor_ref: 'local_prototype',
    command_text: answerText,
    requested_output: 'display_text'
  };
  const resumeResult = await resumeConceptCheckingQuestionFromFile(resumeInput, {
    recordPath: parsed.recordFile,
    resumeToken: parsed.resumeToken,
    commandPackPath: parsed.commandPack ?? config.default_command_pack,
    writeRecord: parsed.writeRecord,
    recordDir: parsed.recordDir ?? config.default_record_dir
  });

  if (!parsed.writeRecord) {
    resumeResult.record_write = {
      status: 'not_written',
      reason: 'ccq resume persistence requires --write-record'
    };
  }

  console.log(JSON.stringify(resumeResult, null, 2));
  process.exit(0);
}

const adapterRequest = parsed.requestFile
  ? await loadAdapterRequest({
      requestPath: parsed.requestFile
    })
  : null;
const commandText = parsed.commandText || adapterRequest?.command_text;

if (parsed.requestFile && parsed.commandText) {
  console.error('Usage error: provide either --request-file or command text, not both.');
  process.exit(2);
}

if (!commandText) {
  console.error(
    'Usage: command-deck [sourcegrid:status|pack:init|pack:open|pack:recent|pack:apply-selection|approval:apply|ccq:resume] [--request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json] [--config commanddeck.config.json] [--command-pack contracts/commands/mvp-commands.cdeck-pack.json] [--pack-slug sourcegrid] [--owner sourcegrid] [--control-root /path/to/repo] [--selection-file evals/fixtures/pack_selections/local-exact.selection.json] [--record-file records/actions/rec_example.json] [--decision-file evals/fixtures/approval_decisions/example.json] [--resume-token ccq_example] [--write-record] [--write-state] [--record-dir records/actions] "What is my next SourceGrid task?"'
  );
  process.exit(2);
}

const commandInput = adapterRequest ?? {
  adapter: 'local_cli',
  actor_ref: 'local_prototype',
  command_text: commandText,
  requested_output: 'display_text'
};

const result = await runLocalCommand(commandInput, {
  commandPackPath: parsed.commandPack ?? config.default_command_pack
});

if (parsed.writeRecord) {
  result.record_write = await writeActionRecord(result.record, {
    recordDir: parsed.recordDir ?? config.default_record_dir
  });
} else {
  result.record_write = {
    status: 'not_written',
    reason: 'record persistence requires --write-record'
  };
}

console.log(JSON.stringify(result, null, 2));

function parseArgs(args) {
  const subcommands = new Set([
    'sourcegrid:status',
    'attachment:status',
    'pack:init',
    'pack:open',
    'pack:recent',
    'pack:apply-selection',
    'approval:apply',
    'ccq:resume'
  ]);
  const commandParts = [];
  let writeRecord = false;
  let writeState = false;
  let recordDir = null;
  let commandPack = null;
  let config = null;
  let stateFile = null;
  let selectionFile = null;
  let packSlug = null;
  let owner = null;
  let controlRoot = null;
  let requestFile = null;
  let recordFile = null;
  let decisionFile = null;
  let resumeToken = null;
  let subcommand = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (index === 0 && subcommands.has(arg)) {
      subcommand = arg;
      continue;
    }

    if (arg === '--write-record') {
      writeRecord = true;
      continue;
    }

    if (arg === '--write-state') {
      writeState = true;
      continue;
    }

    if (arg === '--record-dir') {
      recordDir = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--command-pack') {
      commandPack = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--config') {
      config = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--state-file') {
      stateFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--selection-file') {
      selectionFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--pack-slug') {
      packSlug = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--owner') {
      owner = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--control-root') {
      controlRoot = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--request-file') {
      requestFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--record-file') {
      recordFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--decision-file') {
      decisionFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--resume-token') {
      resumeToken = args[index + 1];
      index += 1;
      continue;
    }

    commandParts.push(arg);
  }

  return {
    commandText: commandParts.join(' ').trim(),
    writeRecord,
    writeState,
    recordDir,
    commandPack,
    config,
    stateFile,
    selectionFile,
    packSlug,
    owner,
    controlRoot,
    requestFile,
    recordFile,
    decisionFile,
    resumeToken,
    subcommand
  };
}
