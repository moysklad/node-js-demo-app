import fs from "node:fs";
import path from "node:path";
import { cfg } from "../config/config";

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;
const JTI_DIRNAME = "jwt-jti";

export function ensurePrivateDir(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: DIR_MODE });

  try {
    fs.chmodSync(directory, DIR_MODE);
  } catch {
    // Best-effort only.
  }
}

export function writePrivateFileAtomic(filename: string, content: string): void {
  ensurePrivateDir(path.dirname(filename));

  const tempFilename = `${filename}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFilename, content, { encoding: "utf-8", mode: FILE_MODE });
  fs.renameSync(tempFilename, filename);

  try {
    fs.chmodSync(filename, FILE_MODE);
  } catch {
    // Best-effort only.
  }
}

export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey.includes("authorization") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("cookie")
    ) {
      result[key] = "[REDACTED]";
      continue;
    }

    result[key] = redactSensitiveValue(nestedValue);
  }

  return result;
}

export function isJwtJtiReplay(jti: string): boolean {
  const directory = path.join(cfg().dataDir, JTI_DIRNAME);
  ensurePrivateDir(directory);
  pruneExpiredJtiMarkers(directory);

  const filename = path.join(directory, `${encodeURIComponent(jti)}.json`);

  if (!fs.existsSync(filename)) {
    return false;
  }

  try {
    const record = JSON.parse(fs.readFileSync(filename, "utf-8")) as unknown;
    const exp = extractExpMillis(record);

    if (exp == null || exp <= Date.now()) {
      fs.rmSync(filename, { force: true });
      return false;
    }

    return true;
  } catch {
    fs.rmSync(filename, { force: true });
    return false;
  }
}

export function rememberJwtJti(jti: string, expUnixSeconds: number): void {
  const directory = path.join(cfg().dataDir, JTI_DIRNAME);
  ensurePrivateDir(directory);

  const filename = path.join(directory, `${encodeURIComponent(jti)}.json`);
  writePrivateFileAtomic(filename, JSON.stringify({ exp: expUnixSeconds * 1000 }));
}

function pruneExpiredJtiMarkers(directory: string): void {
  for (const entry of fs.readdirSync(directory)) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const filename = path.join(directory, entry);

    try {
      const record = JSON.parse(fs.readFileSync(filename, "utf-8")) as unknown;
      const exp = extractExpMillis(record);

      if (exp == null || exp <= Date.now()) {
        fs.rmSync(filename, { force: true });
      }
    } catch {
      fs.rmSync(filename, { force: true });
    }
  }
}

function extractExpMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const exp = (value as Record<string, unknown>).exp;
  return typeof exp === "number" ? exp : null;
}
