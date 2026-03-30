import { NextResponse } from "next/server";

import { activateConfig } from "@/lib/services/operations";
import { getSession } from "@/lib/session";
import { parseNumericId } from "@/lib/utils";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const result = await activateConfig(parseNumericId(id));
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "启用配置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
