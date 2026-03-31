import { NextResponse } from "next/server";

import { authenticateAdmin } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { validateLoginInput } from "@/lib/validation";

function redirectToLogin(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, { status: 303 });
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
      return redirectToLogin(request, "用户名或密码错误。");
    }

    await createSession(input.username);
    return NextResponse.redirect(new URL("/configs", request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败。";
    return redirectToLogin(request, message);
  }
}
