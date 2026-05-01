import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db, DbConfigMissingError } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/guards";

type EventType =
  | "PAGE_VIEW"
  | "QUOTE_STARTED"
  | "QUOTE_ESTIMATE_CALCULATED"
  | "QUOTE_SUBMITTED"
  | "CUSTOMER_REGISTER_STARTED"
  | "CUSTOMER_REGISTERED"
  | "DRIVER_REGISTER_STARTED"
  | "DRIVER_REGISTERED"
  | "QUOTE_CONFIRMATION_VIEWED"
  | "ACCOUNT_QUOTES_VIEWED"
  | "ACCOUNT_QUOTE_DETAIL_VIEWED"
  | "QUOTE_ESTIMATE_STALE"
  | "QUOTE_ESTIMATE_RECALCULATED";

const allowedEventTypes = new Set<EventType>([
  "PAGE_VIEW",
  "QUOTE_STARTED",
  "QUOTE_ESTIMATE_CALCULATED",
  "QUOTE_SUBMITTED",
  "CUSTOMER_REGISTER_STARTED",
  "CUSTOMER_REGISTERED",
  "DRIVER_REGISTER_STARTED",
  "DRIVER_REGISTERED",
  "QUOTE_CONFIRMATION_VIEWED",
  "ACCOUNT_QUOTES_VIEWED",
  "ACCOUNT_QUOTE_DETAIL_VIEWED",
  "QUOTE_ESTIMATE_STALE",
  "QUOTE_ESTIMATE_RECALCULATED",
]);

function hashIp(rawIp: string) {
  const salt = process.env.ANALYTICS_SALT?.trim() || process.env.SESSION_SECRET?.trim() || "analytics-default-salt";
  return crypto.createHash("sha256").update(`${salt}:${rawIp}`).digest("hex");
}

function extractCountryRegion(request: Request) {
  const country = request.headers.get("x-vercel-ip-country") || request.headers.get("cloudfront-viewer-country") || "";
  const region = request.headers.get("x-vercel-ip-country-region") || request.headers.get("cloudfront-viewer-country-region") || "";
  return { country, region };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const eventType = String(payload.eventType || "") as EventType;
    if (!allowedEventTypes.has(eventType)) {
      return NextResponse.json({ ok: false, error: "Invalid event type." }, { status: 400 });
    }

    const path = String(payload.path || "");
    const sessionId = String(payload.sessionId || "");
    const anonymousVisitorId = String(payload.anonymousVisitorId || "");
    if (!path || !sessionId || !anonymousVisitorId) {
      return NextResponse.json({ ok: false, error: "Missing required analytics fields." }, { status: 400 });
    }

    const sessionUser = await getCurrentSessionUser();
    const rawIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "";
    const { country, region } = extractCountryRegion(request);

    await db.createAnalyticsEvent({
      eventType,
      path,
      referrer: String(payload.referrer || ""),
      landingPage: String(payload.landingPage || ""),
      sessionId,
      anonymousVisitorId,
      userId: sessionUser?.userId,
      customerEmail: sessionUser?.email,
      userAgent: request.headers.get("user-agent") || "",
      ipHash: rawIp ? hashIp(rawIp) : "",
      country,
      region,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DbConfigMissingError) {
      return NextResponse.json({ ok: false, error: "Analytics storage is not configured." }, { status: 503 });
    }
    console.error(
      JSON.stringify({
        level: "error",
        source: "api.analytics.event",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );
    return NextResponse.json({ ok: false, error: "Unable to record analytics event." }, { status: 500 });
  }
}
