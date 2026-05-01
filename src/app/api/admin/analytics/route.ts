import { NextResponse } from "next/server";
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { db } from "@/lib/db";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { createServerDynamoClient } from "@/lib/db";

type WindowKey = "today" | "last7Days" | "last30Days";

function getWindowStart(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });

  const tableName = process.env.DDB_TABLE_ANALYTICS_EVENTS?.trim() || "";
  const diagnostics = {
    tableConfigured: Boolean(tableName),
    tableNamePresent: Boolean(tableName),
  };

  if (!tableName) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "ANALYTICS_NOT_CONFIGURED",
        message: "Analytics is not configured.",
        diagnostics,
      },
      { status: 503 }
    );
  }

  try {
    const ddbClient = createServerDynamoClient();
    await ddbClient.send(new DescribeTableCommand({ TableName: tableName }));
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "ANALYTICS_TABLE_UNAVAILABLE",
        message: "Analytics table unavailable.",
        diagnostics,
      },
      { status: 503 }
    );
  }

  try {
    const events = await db.listAnalyticsEvents();
    const windows: Record<WindowKey, Date> = {
      today: getWindowStart(1),
      last7Days: getWindowStart(7),
      last30Days: getWindowStart(30),
    };

    const visitors = { today: new Set<string>(), last7Days: new Set<string>(), last30Days: new Set<string>() };
    const pageViews = { today: 0, last7Days: 0, last30Days: 0 };
    const quoteSubmissions = { today: 0, last7Days: 0, last30Days: 0 };
    const quoteStarts = { today: 0, last7Days: 0, last30Days: 0 };
    const estimateCalculations = { today: 0, last7Days: 0, last30Days: 0 };
    const customerRegistrations = { today: 0, last7Days: 0, last30Days: 0 };
    const driverRegistrations = { today: 0, last7Days: 0, last30Days: 0 };
    const pageCounts = new Map<string, number>();
    const referrerCounts = new Map<string, number>();

    for (const event of events) {
      const created = new Date(event.createdAt);
      for (const [windowKey, start] of Object.entries(windows) as Array<[WindowKey, Date]>) {
        if (created < start) continue;
        visitors[windowKey].add(event.anonymousVisitorId);
        if (event.eventType === "PAGE_VIEW") pageViews[windowKey] += 1;
        if (event.eventType === "QUOTE_SUBMITTED") quoteSubmissions[windowKey] += 1;
        if (event.eventType === "QUOTE_STARTED") quoteStarts[windowKey] += 1;
        if (event.eventType === "QUOTE_ESTIMATE_CALCULATED") estimateCalculations[windowKey] += 1;
        if (event.eventType === "CUSTOMER_REGISTERED") customerRegistrations[windowKey] += 1;
        if (event.eventType === "DRIVER_REGISTERED") driverRegistrations[windowKey] += 1;
      }

      if (event.eventType === "PAGE_VIEW") {
        pageCounts.set(event.path, (pageCounts.get(event.path) || 0) + 1);
        const ref = event.referrer?.trim() || "(direct)";
        referrerCounts.set(ref, (referrerCounts.get(ref) || 0) + 1);
      }
    }

    const topPages = [...pageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, count]) => ({ path, count }));
    const topReferrers = [...referrerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([referrer, count]) => ({ referrer, count }));

    return NextResponse.json({
      ok: true,
      totals: {
        visitors: {
          today: visitors.today.size,
          last7Days: visitors.last7Days.size,
          last30Days: visitors.last30Days.size,
        },
        pageViews,
        quoteSubmissions,
        estimateCalculations,
        customerRegistrations,
        driverRegistrations,
        conversion: {
          visitorsToQuoteSubmission:
            visitors.last30Days.size > 0 ? Number(((quoteSubmissions.last30Days / visitors.last30Days.size) * 100).toFixed(2)) : 0,
          quoteStartToSubmission: quoteStarts.last30Days > 0 ? Number(((quoteSubmissions.last30Days / quoteStarts.last30Days) * 100).toFixed(2)) : 0,
        },
      },
      topPages,
      topReferrers,
      diagnostics,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "ANALYTICS_QUERY_FAILED",
        message: "Analytics table unavailable.",
        diagnostics,
      },
      { status: 503 }
    );
  }
}
