import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentSessionUser } from "@/lib/auth/guards";
import { DbConfigMissingError, db } from "@/lib/db";

export async function POST() {
  const correlationId = crypto.randomUUID();
  const user = await getCurrentSessionUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.testQuoteTableWrite({ correlationId });
    return NextResponse.json({
      ok: true,
      correlationId,
      result,
    });
  } catch (error) {
    if (error instanceof DbConfigMissingError) {
      return NextResponse.json(
        {
          ok: false,
          correlationId,
          errorCode: "DB_CONFIG_MISSING",
          missingEnvVars: error.missingEnvVars,
        },
        { status: 500 }
      );
    }

    const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    return NextResponse.json(
      {
        ok: false,
        correlationId,
        errorCode: "DB_WRITE_FAILED",
        diagnostics: {
          awsErrorName: awsError?.name || "UnknownAwsError",
          awsErrorMessage: awsError?.message || "Unknown AWS SDK error",
          httpStatusCode: awsError?.$metadata?.httpStatusCode ?? null,
          tableEnvVar: "DDB_TABLE_QUOTES",
          tableName: process.env.DDB_TABLE_QUOTES || "NITaxiQuotes",
          operation: "health.dbWriteTest.createQuote",
        },
      },
      { status: 500 }
    );
  }
}
