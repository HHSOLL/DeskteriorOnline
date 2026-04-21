import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  comparePerformanceRegressionReports,
  validatePerformanceRegressionReport,
  type PerformanceRegressionReport
} from "../src/lib/performance/performance-regression";

function getArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

function resolveReport(filePath: string): PerformanceRegressionReport {
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as
    | PerformanceRegressionReport
    | PerformanceRegressionReport["entries"];

  if (Array.isArray(raw)) {
    return {
      generatedAt: new Date().toISOString(),
      entries: raw
    };
  }

  return raw;
}

function printUsage() {
  console.error(
    "usage: node --import tsx scripts/verify-performance-regression-report.ts --report=path/to/report.json [--baseline=path/to/baseline.json]"
  );
}

async function main() {
  const reportPath = getArg("report");
  const baselinePath = getArg("baseline");

  if (!reportPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const report = resolveReport(reportPath);
  const issues = validatePerformanceRegressionReport(report);

  if (issues.length > 0) {
    console.error("performance regression report failed");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("performance regression report ok");
  console.log(
    JSON.stringify(
      {
        entries: report.entries.length,
        scenarios: [...new Set(report.entries.map((entry) => entry.scenario))],
        builds: [...new Set(report.entries.map((entry) => entry.build))]
      },
      null,
      2
    )
  );

  if (!baselinePath) {
    return;
  }

  const baseline = resolveReport(baselinePath);
  const deltas = comparePerformanceRegressionReports(report, baseline);

  console.log("baseline deltas");
  console.log(
    JSON.stringify(
      deltas.map((entry) => ({
        key: entry.key,
        delta: entry.delta
      })),
      null,
      2
    )
  );
}

void main();
