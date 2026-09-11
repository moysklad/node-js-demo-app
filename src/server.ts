import { createApp } from "./app";
import { config } from "./lib/config/config";
import { appVersion } from "./lib/config/app-version";
import { logMessage } from "./lib/observability/logger";

const app = createApp();

app.listen(config.port, () => {
  logMessage("INFO", `Server started on port ${config.port}, version ${appVersion()}`);
});
