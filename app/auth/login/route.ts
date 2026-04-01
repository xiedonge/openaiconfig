import { NextResponse } from "next/server";

import { authenticateAdmin } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { validateLoginInput } from "@/lib/validation";

const INVALID_CREDENTIALS = "\u7528\u6237\u540d\u6216\u5bc6\u7801\u9519\u8bef\u3002";
const LOGIN_FAILED = "\u767b\u5f55\u5931\u8d25\u3002";

function redirectWithLocation(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
    },
  });
}

function redirectToLogin(message: string) {
  const searchParams = new URLSearchParams({ error: message });
  return redirectWithLocation(`/login?${searchParams.toString()}`);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const input = validateLoginInput({
      username: formData.get("username"),
      password: formData.get("password"),
    });

    const authenticated = authenticateAdmin(input.username, input.password);

    if (!authenticated) {
      return redirectToLogin(INVALID_CREDENTIALS);
    }

    await createSession(input.username);
    return redirectWithLocation("/configs");
  } catch (error) {
    const message = error instanceof Error ? error.message : LOGIN_FAILED;
    return redirectToLogin(message);
  }
}
