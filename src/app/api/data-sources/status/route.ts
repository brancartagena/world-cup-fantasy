import { NextResponse } from "next/server";

import { getDataSourceReadiness } from "@/lib/env";

export function GET() {
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    sources: getDataSourceReadiness(),
  });
}
