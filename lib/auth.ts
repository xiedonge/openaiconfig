import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { getAdminUsername } from "@/lib/env";

const HASH_PREFIX = "scrypt";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split("$");

  if (algorithm !== HASH_PREFIX || !salt || !hash) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64);
  const expectedKey = Buffer.from(hash, "hex");

  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedKey);
}

export function authenticateAdmin(username: string, password: string) {
  const configuredUsername = getAdminUsername();
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;

  if (!configuredHash) {
    throw new Error("ADMIN_PASSWORD_HASH is not configured.");
  }

  if (username !== configuredUsername) {
    return false;
  }

  return verifyPassword(password, configuredHash);
}
