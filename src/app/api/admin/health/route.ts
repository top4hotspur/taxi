import { NextResponse } from "next/server";
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { createServerDynamoClient } from "@/lib/db";

const dbEnvVars = [
  "DDB_TABLE_USERS",
  "DDB_TABLE_CUSTOMER_PROFILES",
  "DDB_TABLE_QUOTES",
  "DDB_TABLE_BOOKINGS",
  "DDB_TABLE_QUOTE_AUDITS",
  "DDB_TABLE_DRIVER_PROFILES",
  "DDB_TABLE_DRIVER_DOCUMENTS",
  "DDB_TABLE_DRIVER_REMINDER_LOGS",
  "DDB_TABLE_PRICING_SETTINGS",
  "DDB_TABLE_PRICING_TIME_UPLIFTS",
  "DDB_TABLE_PRICING_DATE_UPLIFTS",
  "DDB_TABLE_ANALYTICS_EVENTS",
] as const;

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const ddbTables = Object.fromEntries(dbEnvVars.map((name) => [name, Boolean(process.env[name]?.trim())]));
  const ddbClient = createServerDynamoClient();
  const ddbTableChecks = await Promise.all(
    dbEnvVars.map(async (envName) => {
      const tableName = process.env[envName]?.trim();
      if (!tableName) {
        return { envVar: envName, configured: false, exists: false, status: null as string | null };
      }
      try {
        const result = await ddbClient.send(new DescribeTableCommand({ TableName: tableName }));
        return {
          envVar: envName,
          configured: true,
          exists: true,
          status: result.Table?.TableStatus || null,
        };
      } catch {
        return { envVar: envName, configured: true, exists: false, status: null as string | null };
      }
    })
  );
  const emailEnvConfigured = Boolean(
    process.env.EMAIL_PROVIDER?.trim() &&
      process.env.RESEND_API_KEY?.trim() &&
      process.env.EMAIL_FROM?.trim() &&
      process.env.ADMIN_EMAIL?.trim()
  );

  return NextResponse.json({
    ok: true,
    sessionRole: user?.role ?? null,
    appAwsRegionPresent: Boolean(process.env.APP_AWS_REGION?.trim()),
    effectiveRegionPresent: Boolean(process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim()),
    appAwsAccessKeyIdPresent: Boolean(process.env.APP_AWS_ACCESS_KEY_ID?.trim()),
    appAwsSecretAccessKeyPresent: Boolean(process.env.APP_AWS_SECRET_ACCESS_KEY?.trim()),
    ddbTables,
    ddbTableChecks,
    analyticsTableEnvPresent: Boolean(process.env.DDB_TABLE_ANALYTICS_EVENTS?.trim()),
    analyticsTableConfig: {
      envVar: "DDB_TABLE_ANALYTICS_EVENTS",
      present: Boolean(process.env.DDB_TABLE_ANALYTICS_EVENTS?.trim()),
      recommendedValue: "ni-taxi-analytics-events",
      expectedSchema: "day:String, createdAtEventId:String",
    },
    awsRegionInUse: process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim() || "eu-west-2",
    pricingTableEnvPresent: {
      settings: Boolean(process.env.DDB_TABLE_PRICING_SETTINGS?.trim()),
      timeUplifts: Boolean(process.env.DDB_TABLE_PRICING_TIME_UPLIFTS?.trim()),
      dateUplifts: Boolean(process.env.DDB_TABLE_PRICING_DATE_UPLIFTS?.trim()),
    },
    emailEnvConfigured,
    googleMapsPublicKeyPresent: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()),
    googleRoutesApiKeyPresent: Boolean(process.env.GOOGLE_ROUTES_API_KEY?.trim()),
  });
}
