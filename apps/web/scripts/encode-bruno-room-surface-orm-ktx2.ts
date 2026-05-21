import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

type EncoderName = "ktx" | "toktx" | "basisu";

type EncodeStatus =
  | "encoded"
  | "up-to-date"
  | "stale"
  | "missing-source"
  | "missing-encoder";

type BrunoOrmTarget = {
  inputPath: string;
  outputPath: string;
  usage: "packedOrm";
  transfer: "linear";
};

type EncodeResult = BrunoOrmTarget & {
  status: EncodeStatus;
  detail?: string;
};

const BRUNO_ROOM_SURFACE_ORM_TARGETS: BrunoOrmTarget[] = [
  {
    inputPath: "/assets/models/p2s_bruno_room_surface_kit/textures/surface_floor_plank_orm_1k.png",
    outputPath: "/assets/models/p2s_bruno_room_surface_kit/textures/surface_floor_plank_orm_1k.ktx2",
    usage: "packedOrm",
    transfer: "linear"
  },
  {
    inputPath: "/assets/models/p2s_bruno_room_surface_kit/textures/surface_plaster_warm_cool_orm_1k.png",
    outputPath: "/assets/models/p2s_bruno_room_surface_kit/textures/surface_plaster_warm_cool_orm_1k.ktx2",
    usage: "packedOrm",
    transfer: "linear"
  },
  {
    inputPath: "/assets/models/p2s_bruno_room_surface_kit/textures/surface_trim_warm_orm_512.png",
    outputPath: "/assets/models/p2s_bruno_room_surface_kit/textures/surface_trim_warm_orm_512.ktx2",
    usage: "packedOrm",
    transfer: "linear"
  }
];

function parseArgs(argv: string[]) {
  const check = argv.includes("--check");
  const json = argv.includes("--json");
  const help = argv.includes("--help");
  const force = argv.includes("--force");
  const unknownArgs = argv.filter(
    (arg) => !["--check", "--json", "--help", "--force"].includes(arg)
  );
  return { check, json, help, force, unknownArgs };
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function detectEncoder(): Promise<EncoderName | null> {
  const candidates: Array<{ name: EncoderName; args: string[] }> = [
    { name: "ktx", args: ["--version"] },
    { name: "toktx", args: ["--version"] },
    { name: "basisu", args: ["-version"] }
  ];

  for (const candidate of candidates) {
    try {
      const result = await runCommand(candidate.name, candidate.args);
      if (result.code === 0) {
        return candidate.name;
      }
    } catch {
      // Keep probing other encoder names.
    }
  }

  return null;
}

async function resolvePathState(inputAbsolutePath: string, outputAbsolutePath: string) {
  try {
    const [inputStats, outputStats] = await Promise.all([
      stat(inputAbsolutePath),
      stat(outputAbsolutePath)
    ]);
    return {
      inputExists: true,
      outputExists: true,
      stale: inputStats.mtimeMs > outputStats.mtimeMs
    };
  } catch {
    try {
      await stat(inputAbsolutePath);
    } catch {
      return {
        inputExists: false,
        outputExists: false,
        stale: false
      };
    }

    return {
      inputExists: true,
      outputExists: false,
      stale: true
    };
  }
}

function toAbsolutePublicPath(appRoot: string, publicPath: string) {
  return path.join(appRoot, "public", publicPath.replace(/^\//, ""));
}

async function encodeWithKtx(tmpInputPath: string, outputAbsolutePath: string) {
  return runCommand("ktx", [
    "create",
    "--format",
    "R8G8B8A8_UNORM",
    "--encode",
    "basis-lz",
    "--generate-mipmap",
    "--assign-tf",
    "linear",
    tmpInputPath,
    outputAbsolutePath
  ]);
}

async function encodeWithToktx(tmpInputPath: string, outputAbsolutePath: string) {
  return runCommand("toktx", [
    "--t2",
    "--genmipmap",
    "--encode",
    "etc1s",
    "--target_type",
    "RGBA",
    "--assign_oetf",
    "linear",
    outputAbsolutePath,
    tmpInputPath
  ]);
}

async function encodeWithBasisu(tmpInputPath: string, outputAbsolutePath: string) {
  return runCommand("basisu", [
    "-ktx2",
    "-linear",
    "-mipmap",
    "-uastc",
    "-uastc_level",
    "2",
    "-quality",
    "100",
    "-output_file",
    outputAbsolutePath,
    tmpInputPath
  ]);
}

async function encodeTarget(
  appRoot: string,
  target: BrunoOrmTarget,
  encoder: EncoderName | null,
  check: boolean,
  force: boolean
): Promise<EncodeResult> {
  const inputAbsolutePath = toAbsolutePublicPath(appRoot, target.inputPath);
  const outputAbsolutePath = toAbsolutePublicPath(appRoot, target.outputPath);
  const state = await resolvePathState(inputAbsolutePath, outputAbsolutePath);

  if (!state.inputExists) {
    return { ...target, status: "missing-source" };
  }

  if (check) {
    return {
      ...target,
      status: state.outputExists && !state.stale ? "up-to-date" : "stale"
    };
  }

  if (!force && state.outputExists && !state.stale) {
    return { ...target, status: "up-to-date" };
  }

  if (!encoder) {
    return {
      ...target,
      status: "missing-encoder",
      detail: "Install `basisu`, `ktx`, or legacy `toktx` before encoding KTX2 textures."
    };
  }

  await mkdir(path.dirname(outputAbsolutePath), { recursive: true });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "deskterioronline-bruno-orm-ktx2-"));
  const tmpInputPath = path.join(
    tempDir,
    `${path.basename(target.inputPath, path.extname(target.inputPath))}.png`
  );

  try {
    await sharp(inputAbsolutePath).ensureAlpha().png().toFile(tmpInputPath);

    const result =
      encoder === "ktx"
        ? await encodeWithKtx(tmpInputPath, outputAbsolutePath)
        : encoder === "toktx"
          ? await encodeWithToktx(tmpInputPath, outputAbsolutePath)
          : await encodeWithBasisu(tmpInputPath, outputAbsolutePath);

    if (result.code !== 0) {
      return {
        ...target,
        status: "stale",
        detail: result.stderr || result.stdout || `${encoder} exited with code ${result.code}`
      };
    }

    return { ...target, status: "encoded" };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const { check, json, help, force, unknownArgs } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log(
      [
        "Usage: node --import tsx apps/web/scripts/encode-bruno-room-surface-orm-ktx2.ts [options]",
        "",
        "Options:",
        "  --check   Verify that expected .ktx2 outputs exist and are fresher than source ORM PNG files",
        "  --force   Re-encode even if the output is already up-to-date",
        "  --json    Print machine-readable summary JSON",
        "  --help    Show help"
      ].join("\n")
    );
    process.exit(0);
  }

  if (unknownArgs.length > 0) {
    console.error(`Unknown arguments: ${unknownArgs.join(", ")}`);
    process.exit(1);
  }

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const appRoot = path.resolve(scriptDir, "..");
  const encoder = check ? null : await detectEncoder();
  const results = await Promise.all(
    BRUNO_ROOM_SURFACE_ORM_TARGETS.map((target) => encodeTarget(appRoot, target, encoder, check, force))
  );

  const ok = results.every((result) => result.status === "encoded" || result.status === "up-to-date");
  const summary = {
    ok,
    mode: check ? "check" : "encode",
    encoder,
    counts: {
      targets: results.length,
      encoded: results.filter((result) => result.status === "encoded").length,
      upToDate: results.filter((result) => result.status === "up-to-date").length,
      stale: results.filter((result) => result.status === "stale").length,
      missingSource: results.filter((result) => result.status === "missing-source").length,
      missingEncoder: results.filter((result) => result.status === "missing-encoder").length
    },
    results
  };

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("Bruno Room Surface ORM KTX2 Encode");
    console.log(`Status: ${summary.ok ? "PASS" : "FAIL"}`);
    console.log(`Mode: ${summary.mode}`);
    console.log(`Encoder: ${encoder ?? "missing"}`);
    console.log("");
    results.forEach((result) => {
      console.log(
        `- ${result.status} | ${result.usage} | ${result.transfer} | ${result.inputPath} -> ${result.outputPath}`
      );
      if (result.detail) {
        console.log(`  - ${result.detail}`);
      }
    });
  }

  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
