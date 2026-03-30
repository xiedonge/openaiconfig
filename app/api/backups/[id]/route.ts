import { NextResponse } from "next/server";

import { getBackupSetById } from "@/lib/services/backups";
import { getSession } from "@/lib/session";
import { parseNumericId } from "@/lib/utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const backup = getBackupSetById(parseNumericId(id));

    if (!backup) {
      return NextResponse.json({ error: "Backup set not found." }, { status: 404 });
    }

    return NextResponse.json({ backup });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取备份失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
