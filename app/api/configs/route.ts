import { NextResponse } from "next/server";

import { listConfigs, createConfig } from "@/lib/services/configs";
import { getSession } from "@/lib/session";
import { parseAppType, validateConfigInput } from "@/lib/validation";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const appTypeParam = new URL(request.url).searchParams.get("appType");
    const configs = listConfigs(appTypeParam ? parseAppType(appTypeParam) : undefined);
    return NextResponse.json({ configs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载配置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = validateConfigInput(await request.json());
    const config = createConfig(input);
    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增配置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
