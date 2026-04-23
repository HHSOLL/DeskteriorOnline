import { runVerifyPublishedRuntimePackagesCli } from "@deskterioronline/asset-compiler";

runVerifyPublishedRuntimePackagesCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
