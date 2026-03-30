import { NextResponse } from "next/server";

import { restoreBackupSet } from "@/lib/services/operations";
import { getSession } from "@/lib/session";
import { parseNumericId } from "@/lib/utils";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const result = await restoreBackupSet(parseNumericId(id));
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "还原备份失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
