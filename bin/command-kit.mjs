#!/usr/bin/env node
import process from 'node:process';
import {
  loadAdapterRequest,
  loadCommandKitConfig,
  runLocalCommand,
  writeActionRecord
} from '../packages/shell-core/index.mjs';

const parsed = parseArgs(process.argv.slice(2));
const config = await loadCommandKitConfig({
  configPath: parsed.config
});
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
    'Usage: command-kit [--request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json] [--config commandkit.config.json] [--command-pack contracts/commands/mvp-commands.json] [--write-record] [--record-dir records/actions] "What is my next SourceGrid task?"'
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
  const commandParts = [];
  let writeRecord = false;
  let recordDir = null;
  let commandPack = null;
  let config = null;
  let requestFile = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--write-record') {
      writeRecord = true;
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

    if (arg === '--request-file') {
      requestFile = args[index + 1];
      index += 1;
      continue;
    }

    commandParts.push(arg);
  }

  return {
    commandText: commandParts.join(' ').trim(),
    writeRecord,
    recordDir,
    commandPack,
    config,
    requestFile
  };
}
