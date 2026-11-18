import { createApp } from "./app";
import { config } from "./lib/config/config";
import { appVersion } from "./lib/config/app-version";
import { logMessage } from "./lib/observability/logger";

createApp()
  .then((app) => {
    app.listen(config.port, () => {
      logMessage("INFO", `Server started on port ${config.port}, version ${appVersion()}`);
    });
  })
  .catch((error: unknown) => {
    logMessage("ERROR", error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
