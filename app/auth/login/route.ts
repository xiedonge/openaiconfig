import { NextResponse } from "next/server";

import { authenticateAdmin } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { validateLoginInput } from "@/lib/validation";

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
      return redirectToLogin("用户名或密码错误。");
    }

    await createSession(input.username);
    return redirectWithLocation("/configs");
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败。";
    return redirectToLogin(message);
  }
}
