import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["apps/web/src"];
const ALLOWLIST_BY_LABEL = {
  "process.env.RAILWAY_API_URL": new Set([
    "apps/web/src/app/api/v1/assets/generate/route.ts",
    "apps/web/src/app/api/v1/assets/route.ts",
    "apps/web/src/app/api/v1/product-assets/generate/route.ts"
  ])
};
const FORBIDDEN_RULES = [
  {
    pattern: /NEXT_PUBLIC_RAILWAY_API_URL/g,
    label: "NEXT_PUBLIC_RAILWAY_API_URL"
  },
  {
    pattern: /process\.env\.RAILWAY_API_URL/g,
    label: "process.env.RAILWAY_API_URL"
  },
  {
    pattern: /https?:\/\/[A-Za-z0-9.-]*railway\.app/gi,
    label: "hardcoded railway.app host"
  }
];
const EXCLUDED_DIR_NAMES = new Set(["node_modules", ".next", ".turbo"]);
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);

async function walk(dirPath, filePaths) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) {
        continue;
      }
    }

    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) {
        continue;
      }
      await walk(absolute, filePaths);
      continue;
    }

    if (entry.isFile() && FILE_EXTENSIONS.has(path.extname(entry.name))) {
      filePaths.push(absolute);
    }
  }
}

function getLine(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === "\n") {
      line += 1;
    }
  }
  return line;
}

async function main() {
  const files = [];
  for (const relativeDir of TARGET_DIRS) {
    const absoluteDir = path.join(ROOT, relativeDir);
    await walk(absoluteDir, files);
  }

  const violations = [];
  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    for (const rule of FORBIDDEN_RULES) {
      const matcher = new RegExp(rule.pattern.source, rule.pattern.flags);
      for (const match of content.matchAll(matcher)) {
        if (typeof match.index !== "number") {
          continue;
        }
        const relativePath = path.relative(ROOT, filePath);
        const allowlistedPaths = ALLOWLIST_BY_LABEL[rule.label];
        if (allowlistedPaths?.has(relativePath)) {
          continue;
        }
        violations.push({
          filePath: relativePath,
          pattern: rule.label,
          line: getLine(content, match.index)
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error("[check-web-boundary] Found forbidden public Railway URL usage:");
    for (const violation of violations) {
      console.error(` - ${violation.filePath}:${violation.line} (${violation.pattern})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `[check-web-boundary] OK (${TARGET_DIRS.join(", ")}): no public Railway env or hardcoded railway host detected.`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[check-web-boundary] Failed: ${message}`);
  process.exitCode = 1;
});
