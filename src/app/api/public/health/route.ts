import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      site: "NI Taxi Co",
      domain: "www.nitaxico.com",
      timestamp: new Date().toISOString(),
      public: true,
    },
    { status: 200 }
  );
}

