import fs from "node:fs";
import path from "node:path";

let cachedAppVersion: string | null = null;

export function appVersion(): string {
  if (cachedAppVersion !== null) {
    return cachedAppVersion;
  }

  const packageJsonPath = path.resolve(process.cwd(), "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    cachedAppVersion = "dev";
    return cachedAppVersion;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
  cachedAppVersion = typeof packageJson.version === "string" && packageJson.version.trim() !== ""
    ? packageJson.version
    : "dev";

  return cachedAppVersion;
}
