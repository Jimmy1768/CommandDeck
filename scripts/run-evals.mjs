import process from 'node:process';
import { runApprovalDecisionEvalSuite, runEvalSuite, writeEvalReport } from '../packages/shell-core/index.mjs';

const parsed = parseArgs(process.argv.slice(2));
const report =
  parsed.kind === 'approval'
    ? await runApprovalDecisionEvalSuite({
        suitePath: parsed.suitePath
      })
    : await runEvalSuite({
        suitePath: parsed.suitePath,
        commandPackPath: parsed.commandPackPath
      });

if (parsed.writeReport) {
  report.report_write = await writeEvalReport(report, {
    reportPath: parsed.reportPath,
    overwrite: parsed.overwrite
  });
} else {
  report.report_write = {
    status: 'not_written',
    reason: 'eval report persistence requires --write-report'
  };
}

console.log(JSON.stringify(report, null, 2));
process.exitCode = report.summary.failed > 0 ? 1 : 0;

function parseArgs(args) {
  let suitePath = 'evals/cases/mvp.slice1.cases.json';
  let commandPackPath = 'contracts/commands/mvp-commands.json';
  let reportPath = null;
  let writeReport = false;
  let overwrite = false;
  let kind = 'command';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--suite') {
      suitePath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--command-pack') {
      commandPackPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--write-report') {
      writeReport = true;
      continue;
    }

    if (arg === '--report') {
      reportPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--overwrite') {
      overwrite = true;
      continue;
    }

    if (arg === '--kind') {
      kind = args[index + 1];
      index += 1;
      continue;
    }
  }

  return {
    suitePath,
    commandPackPath,
    reportPath,
    writeReport,
    overwrite,
    kind
  };
}
