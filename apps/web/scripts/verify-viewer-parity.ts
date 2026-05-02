import { spawnSync } from "node:child_process";
import path from "node:path";

type ViewerParityCheck = {
  id: string;
  scriptPath: string;
  coverage: string[];
};

const checks: ViewerParityCheck[] = [
  {
    id: "public-scene-payload",
    scriptPath: "scripts/verify-public-scene-payload.ts",
    coverage: ["pinned project version", "scene document hash", "runtime asset refs", "product snapshots"]
  },
  {
    id: "showcase-scene-consistency",
    scriptPath: "scripts/verify-showcase-scene-consistency.ts",
    coverage: ["shared/showcase token parity", "version badge parity", "thumbnail source", "scene snapshot refs"]
  }
];

function runCheck(check: ViewerParityCheck) {
  const webRoot = process.cwd();
  const result = spawnSync(process.execPath, ["--import", "tsx", path.join(webRoot, check.scriptPath)], {
    cwd: webRoot,
    encoding: "utf8",
    env: process.env
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${check.id} failed${output ? `\n${output}` : ""}`);
  }

  return {
    id: check.id,
    script: check.scriptPath,
    status: "pass" as const,
    coverage: check.coverage
  };
}

try {
  const results = checks.map(runCheck);
  console.log(
    JSON.stringify(
      {
        status: "pass",
        checks: results
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-viewer-parity] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
