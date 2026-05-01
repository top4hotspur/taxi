import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  DeleteItemCommand,
  DescribeTableCommand,
  PutItemCommand,
  type KeySchemaElement,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { createServerDynamoClient } from "@/lib/db";

// TODO: Remove or lock down this diagnostic endpoint before production launch.

const OPERATION = "health.dbWriteTest.quotePut";

function buildFailure(params: {
  stage: "ENV_CHECK" | "DESCRIBE_TABLE" | "PUT_ITEM" | "DELETE_ITEM";
  tableName: string;
  keySchema: KeySchemaElement[];
  error?: unknown;
}) {
  const awsError = params.error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } } | undefined;
  return NextResponse.json(
    {
      ok: false,
      stage: params.stage,
      awsErrorName: awsError?.name || null,
      awsErrorMessage: awsError?.message || null,
      httpStatusCode: awsError?.$metadata?.httpStatusCode ?? null,
      tableName: params.tableName,
      keySchema: params.keySchema,
      operation: OPERATION,
    },
    { status: 500 }
  );
}

function getKeyAttributeName(keySchema: KeySchemaElement[], keyType: "HASH" | "RANGE") {
  return keySchema.find((entry) => entry.KeyType === keyType)?.AttributeName;
}

export async function GET() {
  const tableName = process.env.DDB_TABLE_QUOTES || "NITaxiQuotes";
  const quoteAuditTableConfigured = Boolean(process.env.DDB_TABLE_QUOTE_AUDITS?.trim());

  const envChecks = {
    appAwsRegionPresent: Boolean(process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim()),
    quoteTablePresent: Boolean(process.env.DDB_TABLE_QUOTES?.trim()),
    quoteAuditsTablePresent: quoteAuditTableConfigured,
  };

  if (!envChecks.appAwsRegionPresent || !envChecks.quoteTablePresent || !envChecks.quoteAuditsTablePresent) {
    return NextResponse.json(
      {
        ok: false,
        stage: "ENV_CHECK",
        tableName,
        keySchema: [],
        operation: OPERATION,
        ...envChecks,
      },
      { status: 500 }
    );
  }

  const ddbClient = createServerDynamoClient();

  let keySchema: KeySchemaElement[] = [];
  let tableStatus: string | undefined;
  let billingMode: string | undefined;

  try {
    const describeResult = await ddbClient.send(new DescribeTableCommand({ TableName: tableName }));
    keySchema = describeResult.Table?.KeySchema || [];
    tableStatus = describeResult.Table?.TableStatus;
    billingMode = describeResult.Table?.BillingModeSummary?.BillingMode;
  } catch (error) {
    return buildFailure({
      stage: "DESCRIBE_TABLE",
      tableName,
      keySchema,
      error,
    });
  }

  const partitionKeyName = getKeyAttributeName(keySchema, "HASH");
  const sortKeyName = getKeyAttributeName(keySchema, "RANGE");
  if (!partitionKeyName) {
    return NextResponse.json(
      {
        ok: false,
        stage: "DESCRIBE_TABLE",
        tableName,
        keySchema,
        operation: OPERATION,
        awsErrorName: "TableKeySchemaInvalid",
        awsErrorMessage: "Quote table is missing HASH key in key schema.",
      },
      { status: 500 }
    );
  }

  const insertedTestId = `diag-${crypto.randomUUID()}`;
  const testItem: Record<string, unknown> = {
    id: insertedTestId,
    accountType: "PERSONAL",
    serviceType: "HEALTH_CHECK",
    pickupLocation: "Diagnostic Pickup",
    dropoffLocation: "Diagnostic Dropoff",
    pickupDate: "2099-01-01",
    pickupTime: "00:00",
    passengers: 1,
    returnJourney: false,
    quotedCurrency: "GBP",
    status: "QUOTE_REQUESTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    itineraryMessage: "Temporary diagnostic write test item.",
    guestEmail: "diagnostic@example.com",
    guestName: "Diagnostic",
    guestPhone: "N/A",
    golfBags: 0,
    luggage: "",
    diagnosticTest: true,
    diagnosticMarker: "DB_WRITE_TEST",
  };

  if (testItem[partitionKeyName] === undefined) {
    testItem[partitionKeyName] = insertedTestId;
  }
  if (sortKeyName && testItem[sortKeyName] === undefined) {
    testItem[sortKeyName] = `${OPERATION}#${insertedTestId}`;
  }

  try {
    await ddbClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(testItem, { removeUndefinedValues: true }),
      })
    );
  } catch (error) {
    return buildFailure({
      stage: "PUT_ITEM",
      tableName,
      keySchema,
      error,
    });
  }

  let deleteAttempted = false;
  try {
    deleteAttempted = true;
    const deleteKey: Record<string, unknown> = {
      [partitionKeyName]: testItem[partitionKeyName],
    };
    if (sortKeyName) {
      deleteKey[sortKeyName] = testItem[sortKeyName];
    }

    await ddbClient.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: marshall(deleteKey, { removeUndefinedValues: true }),
      })
    );
  } catch (error) {
    return buildFailure({
      stage: "DELETE_ITEM",
      tableName,
      keySchema,
      error,
    });
  }

  return NextResponse.json({
    ok: true,
    operation: OPERATION,
    tableName,
    tableStatus: tableStatus || null,
    keySchema,
    billingMode: billingMode || null,
    insertedTestId,
    deleteAttempted,
  });
}
