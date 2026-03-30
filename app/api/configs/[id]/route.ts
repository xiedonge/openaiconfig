import { NextResponse } from "next/server";

import { deleteConfig, updateConfig } from "@/lib/services/configs";
import { getSession } from "@/lib/session";
import { parseNumericId } from "@/lib/utils";
import { validateConfigInput } from "@/lib/validation";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const config = updateConfig(parseNumericId(id), validateConfigInput(await request.json()));
    return NextResponse.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新配置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    deleteConfig(parseNumericId(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除配置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
