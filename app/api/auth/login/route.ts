import { NextResponse } from "next/server";

import { authenticateAdmin } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { validateLoginInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = validateLoginInput(await request.json());
    const authenticated = authenticateAdmin(input.username, input.password);

    if (!authenticated) {
      return NextResponse.json({ error: "用户名或密码错误。" }, { status: 401 });
    }

    await createSession(input.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败。";
    const status = message.includes("configured") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
