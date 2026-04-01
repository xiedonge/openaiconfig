import { NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { readSystemUpdateStatus, startSystemUpdate } from "@/lib/services/systemUpdate";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await readSystemUpdateStatus();
  return NextResponse.json({ status });
}

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await startSystemUpdate();
    return NextResponse.json({ status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "\u542f\u52a8\u66f4\u65b0\u5931\u8d25\u3002";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
