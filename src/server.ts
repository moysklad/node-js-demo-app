import { createApp } from "./app";
import { config } from "./lib/config";
import { logMessage } from "./lib/logger";

const app = createApp();

app.listen(config.port, () => {
  logMessage("INFO", `Server started on port ${config.port}`);
});
