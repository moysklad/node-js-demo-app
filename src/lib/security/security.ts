import crypto from "node:crypto";
import { config } from "../config/config";
import { logMessage } from "../observability/logger";

const ENCRYPT_PREFIX = "enc:v1:";

class DecryptionError extends Error {}

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

  try {
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf-8");
  } catch {
    throw new DecryptionError("Encrypted payload does not match APP_ENCRYPT_KEY");
  }
}

/**
 * После смены APP_ENCRYPT_KEY старые данные не расшифровать. Считаем их отсутствующими,
 * чтобы решение можно было удалить и установить заново, а не получать 500 на каждом запросе.
 */
export function decryptSensitiveOrNull(cipherTextOrPlain: string, description: string): string | null {
  try {
    return decryptSensitive(cipherTextOrPlain);
  } catch (error) {
    if (!(error instanceof DecryptionError)) {
      throw error;
    }

    logMessage("WARN", `${description} is encrypted with another APP_ENCRYPT_KEY, treating it as missing`);
    return null;
  }
}

function deriveEncryptionKey(rawKey: string): Buffer {
  const normalized = rawKey.trim();

  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("APP_ENCRYPT_KEY must be 64 hex characters");
  }

  return Buffer.from(normalized, "hex");
}
