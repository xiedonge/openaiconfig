import { NextResponse } from "next/server";

import { listBackups } from "@/lib/services/backups";
import { getSession } from "@/lib/session";
import { parseBackupScope, parseTriggerType } from "@/lib/validation";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const scope = searchParams.get("appType");
    const triggerType = searchParams.get("triggerType");
    const backups = listBackups({
      scope: scope ? parseBackupScope(scope) : undefined,
      triggerType: triggerType ? parseTriggerType(triggerType) : undefined,
    });

    return NextResponse.json({ backups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载备份失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
