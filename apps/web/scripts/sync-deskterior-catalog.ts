import { runSyncCuratedCatalogCli } from "@deskterioronline/asset-compiler";

runSyncCuratedCatalogCli().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
