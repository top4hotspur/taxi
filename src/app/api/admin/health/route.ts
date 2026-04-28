import { NextResponse } from "next/server";
import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getCurrentSessionUser } from "@/lib/auth/guards";

const dbEnvVars = [
  "DDB_TABLE_USERS",
  "DDB_TABLE_CUSTOMER_PROFILES",
  "DDB_TABLE_QUOTES",
  "DDB_TABLE_BOOKINGS",
  "DDB_TABLE_QUOTE_AUDITS",
  "DDB_TABLE_DRIVER_PROFILES",
  "DDB_TABLE_DRIVER_DOCUMENTS",
  "DDB_TABLE_DRIVER_REMINDER_LOGS",
] as const;

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const ddbTables = Object.fromEntries(dbEnvVars.map((name) => [name, Boolean(process.env[name]?.trim())]));
  const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || "eu-west-2";
  const ddbClient = new DynamoDBClient({ region });
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
    sessionRole: user.role,
    appAwsRegionPresent: Boolean(process.env.APP_AWS_REGION?.trim()),
    effectiveRegionPresent: Boolean(process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim()),
    ddbTables,
    ddbTableChecks,
    emailEnvConfigured,
    googleMapsPublicKeyPresent: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()),
  });
}
