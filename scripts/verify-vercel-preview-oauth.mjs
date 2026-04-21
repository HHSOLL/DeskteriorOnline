#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function fail(message) {
  console.error(`[verify-vercel-preview-oauth] ${message}`);
  process.exit(1);
}

const repoRoot = process.cwd();
const projectConfigPath = path.join(repoRoot, ".vercel", "project.json");

let projectConfig;
try {
  projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf8"));
} catch (error) {
  fail(`.vercel/project.json을 읽지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
}

if (!projectConfig?.projectId || !projectConfig?.orgId) {
  fail(".vercel/project.json에 projectId/orgId가 없습니다.");
}

let project;
try {
  const response = execFileSync(
    "vercel",
    [
      "api",
      `/v9/projects/${projectConfig.projectId}?teamId=${projectConfig.orgId}`,
      "--raw"
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  project = JSON.parse(response);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`Vercel 프로젝트 설정을 읽지 못했습니다: ${message}`);
}

if (project.ssoProtection !== null) {
  const deploymentType =
    typeof project.ssoProtection === "object" && project.ssoProtection
      ? project.ssoProtection.deploymentType ?? "unknown"
      : "unknown";
  fail(
    `preview OAuth readiness 실패: ssoProtection=${deploymentType}. ` +
      "Preview에서 Google/Kakao OAuth를 테스트하려면 Vercel Authentication이 preview/deployment URL에 걸려 있지 않아야 합니다."
  );
}

const envEntries = Array.isArray(project.env) ? project.env : [];
const productionAppUrl = envEntries.find(
  (entry) => entry?.key === "NEXT_PUBLIC_APP_URL" && Array.isArray(entry?.target) && entry.target.includes("production")
);

if (!productionAppUrl) {
  fail("production NEXT_PUBLIC_APP_URL이 없습니다. production canonical OAuth host 검증이 누락됐습니다.");
}

console.log("[verify-vercel-preview-oauth] OK");
console.log(
  JSON.stringify(
    {
      project: project.name ?? projectConfig.projectName ?? projectConfig.projectId,
      ssoProtection: project.ssoProtection,
      hasProductionAppUrl: true
    },
    null,
    2
  )
);
