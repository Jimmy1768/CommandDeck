#!/usr/bin/env node
import process from 'node:process';
import { runLocalCommand, writeActionRecord } from '../packages/shell-core/index.mjs';

const parsed = parseArgs(process.argv.slice(2));
const commandText = parsed.commandText;

if (!commandText) {
  console.error('Usage: command-kit [--write-record] [--record-dir records/actions] "What is my next SourceGrid task?"');
  process.exit(2);
}

const result = await runLocalCommand({
  adapter: 'local_cli',
  actor_ref: 'local_prototype',
  command_text: commandText,
  requested_output: 'display_text'
});

if (parsed.writeRecord) {
  result.record_write = await writeActionRecord(result.record, {
    recordDir: parsed.recordDir
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
  let recordDir = 'records/actions';

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

    commandParts.push(arg);
  }

  return {
    commandText: commandParts.join(' ').trim(),
    writeRecord,
    recordDir
  };
}
