import fs from "node:fs";
import crypto from "node:crypto";
import { config } from "../config/config";

const DIR_MODE = 0o700;
const ENCRYPT_PREFIX = "enc:v1:";

export function ensurePrivateDir(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: DIR_MODE });

  try {
    fs.chmodSync(directory, DIR_MODE);
  } catch {
    // Best-effort only.
  }
}

export function encryptSensitive(plainText: string): string {
  const key = deriveEncryptionKey(config.encryptKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPT_PREFIX}${iv.toString("base64url")}:${encrypted.toString("base64url")}:${authTag.toString("base64url")}`;
}

export function decryptSensitive(cipherTextOrPlain: string): string {
  if (!cipherTextOrPlain.startsWith(ENCRYPT_PREFIX)) {
    return cipherTextOrPlain;
  }

  const encoded = cipherTextOrPlain.slice(ENCRYPT_PREFIX.length);
  const [ivEncoded, payloadEncoded, tagEncoded] = encoded.split(":");

  if (!ivEncoded || !payloadEncoded || !tagEncoded) {
    throw new Error("Invalid encrypted payload format");
  }

  const key = deriveEncryptionKey(config.encryptKey);
  const iv = Buffer.from(ivEncoded, "base64url");
  const payload = Buffer.from(payloadEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString("utf-8");
}

function deriveEncryptionKey(rawKey: string): Buffer {
  const normalized = rawKey.trim();

  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("APP_ENCRYPT_KEY must be 64 hex characters");
  }

  return Buffer.from(normalized, "hex");
}
