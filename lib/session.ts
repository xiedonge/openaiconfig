import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieSecure, getSessionSecret, getSessionTtlSeconds } from "@/lib/env";
import type { SessionUser } from "@/types";

export const SESSION_COOKIE_NAME = "config-manager-session";

interface SessionPayload {
  username: string;
  expiresAt: number;
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function serializePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function deserializePayload(payload: string) {
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
}

export async function createSession(username: string) {
  const expiresAt = Date.now() + getSessionTtlSeconds() * 1000;
  const payload = serializePayload({ username, expiresAt });
  const signature = signSessionPayload(payload);
  const cookieValue = `${payload}.${signature}`;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: getSessionCookieSecure(),
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: getSessionCookieSecure(),
    path: "/",
    expires: new Date(0),
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const decoded = deserializePayload(payload);

  if (decoded.expiresAt <= Date.now()) {
    return null;
  }

  const sessionUser: SessionUser = {
    username: decoded.username,
    expiresAt: decoded.expiresAt,
  };

  return sessionUser;
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
