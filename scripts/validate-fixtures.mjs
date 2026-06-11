import { spawn } from 'node:child_process';
import process from 'node:process';

const child = spawn(process.execPath, ['--test', 'test/fixture-contracts.test.mjs'], {
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
