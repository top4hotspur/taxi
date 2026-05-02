import crypto from "node:crypto";
import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || "eu-west-2";
const appAccessKeyId = process.env.APP_AWS_ACCESS_KEY_ID?.trim();
const appSecretAccessKey = process.env.APP_AWS_SECRET_ACCESS_KEY?.trim();

// TEMPORARY PRODUCTION UNBLOCK: explicit server-side AWS credentials for SSR/API runtime.
// TODO: Replace with IAM role/AppSync/Amplify Data client pattern before long-term production hardening.
export function createServerDynamoClient() {
  return new DynamoDBClient({
    region,
    ...(appAccessKeyId && appSecretAccessKey
      ? {
          credentials: {
            accessKeyId: appAccessKeyId,
            secretAccessKey: appSecretAccessKey,
          },
        }
      : {}),
  });
}

const ddbClient = createServerDynamoClient();
const ddb = DynamoDBDocumentClient.from(ddbClient);

const TABLE_USERS = process.env.DDB_TABLE_USERS || "NITaxiUsers";
const TABLE_CUSTOMER_PROFILES = process.env.DDB_TABLE_CUSTOMER_PROFILES || "NITaxiCustomerProfiles";
const TABLE_QUOTES = process.env.DDB_TABLE_QUOTES || "NITaxiQuotes";
const TABLE_BOOKINGS = process.env.DDB_TABLE_BOOKINGS || "NITaxiBookings";
const TABLE_QUOTE_AUDITS = process.env.DDB_TABLE_QUOTE_AUDITS || "NITaxiQuoteAudits";
const TABLE_DRIVER_PROFILES = process.env.DDB_TABLE_DRIVER_PROFILES || "NITaxiDriverProfiles";
const TABLE_DRIVER_DOCUMENTS = process.env.DDB_TABLE_DRIVER_DOCUMENTS || "NITaxiDriverDocuments";
const TABLE_DRIVER_REMINDER_LOGS = process.env.DDB_TABLE_DRIVER_REMINDER_LOGS || "NITaxiDriverReminderLogs";
const TABLE_PRICING_SETTINGS = process.env.DDB_TABLE_PRICING_SETTINGS || "NITaxiPricingSettings";
const TABLE_PRICING_TIME_UPLIFTS = process.env.DDB_TABLE_PRICING_TIME_UPLIFTS || "NITaxiPricingTimeUplifts";
const TABLE_PRICING_DATE_UPLIFTS = process.env.DDB_TABLE_PRICING_DATE_UPLIFTS || "NITaxiPricingDateUplifts";
const TABLE_ANALYTICS_EVENTS = process.env.DDB_TABLE_ANALYTICS_EVENTS?.trim();

const REQUIRED_DB_ENV_VARS = [
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
] as const;

type Role = "CUSTOMER" | "ADMIN" | "DRIVER";

export interface UserRecord { id: string; email: string; passwordHash: string; role: Role; createdAt: string; updatedAt: string }
export interface CustomerProfileRecord { id: string; userId: string; accountType: string; name: string; phone: string; country: string; addressLine1: string; addressLine2?: string | null; city: string; region: string; postalCode: string; addressCountry: string; businessName?: string | null; tourOperatorName?: string | null; website?: string | null; taxIdVatNumber?: string | null; createdAt: string; updatedAt: string }
export interface QuoteRecord {
  id: string;
  customerId?: string;
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  passengerName?: string;
  passengerPhone?: string;
  accountType: string;
  serviceType: string;
  pickupLocation: string;
  pickupPlaceId?: string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLocation: string;
  dropoffPlaceId?: string;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  pickupDate: string;
  pickupTime: string;
  passengers: number;
  handLuggageCount?: number;
  suitcaseCount?: number;
  oversizeItemCount?: number;
  luggage?: string;
  golfBags?: number;
  returnJourney: boolean;
  returnJourneyNeeded?: boolean;
  returnPickup?: string;
  returnPickupPlaceId?: string;
  returnPickupAddress?: string;
  returnPickupLat?: number;
  returnPickupLng?: number;
  returnDropoff?: string;
  returnDropoffPlaceId?: string;
  returnDropoffAddress?: string;
  returnDropoffLat?: number;
  returnDropoffLng?: number;
  returnDate?: string;
  returnTime?: string;
  itineraryMessage?: string;
  adminNotes?: string;
  adminCustomerMessage?: string;
  quotedPrice?: number;
  quotedCurrency: string;
  estimatedFare?: number;
  finalEstimatedFare?: number;
  outwardEstimatedFare?: number;
  returnEstimatedFare?: number;
  returnDiscountPercent?: number;
  returnDiscountAmount?: number;
  estimatedCurrency?: string;
  estimatedDistanceMiles?: number;
  estimatedDurationMinutes?: number;
  estimatedFareBreakdown?: string;
  pricingSource?: string;
  requiresManualReview?: boolean;
  pricingCalculatedAt?: string;
  routeEstimateFailed?: boolean;
  routeEstimateFailureReason?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface BookingRecord { id: string; quoteId: string; confirmed: boolean; createdAt: string; updatedAt: string }
export interface QuoteAuditRecord { id: string; quoteId: string; changedByRole: string; changedByUserId?: string; previousStatus?: string; newStatus: string; note?: string; createdAt: string }

export interface DriverProfileRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  mobile: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  carMake: string;
  carModel: string;
  registrationNumber: string;
  passengerCapacity: number;
  suitcaseCapacity: number;
  profilePhoto?: string | null;
  status: "PENDING" | "INCOMPLETE" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
}

export interface DriverDocumentRecord {
  id: string;
  userId: string;
  type: "TAXI_LICENCE" | "TAXI_CAR_LICENCE" | "INSURANCE" | "DRIVING_LICENCE";
  uploadedFileReference: string;
  expiryDate?: string | null;
  status: "MISSING" | "UPLOADED" | "APPROVED" | "REJECTED" | "EXPIRED";
  adminNotes?: string | null;
  uploadedAt: string;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverReminderLogRecord {
  id: string;
  driverId: string;
  documentId?: string | null;
  reminderType: string;
  reminderKey: string;
  sentAt: string;
}


export interface PricingSettingsRecord {
  id: string;
  baseFare: number;
  perMile: number;
  perMinute: number;
  minimumFare: number;
  currency: string;
  airportSurchargeAmount?: number;
  standardPassengerMax?: number;
  passengerBand_5_6_UpliftPercent?: number;
  passengerBand_7_8_UpliftPercent?: number;
  airportUpliftPercent?: number;
  dublinAirportUpliftPercent?: number;
  golfBagSurcharge?: number;
  largeLuggageSurcharge?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingTimeUpliftRecord {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  upliftPercent: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingDateUpliftRecord {
  id: string;
  label: string;
  upliftPercent: number;
  active: boolean;
  ruleType: "SINGLE_DATE" | "DATE_RANGE" | "RECURRING_ANNUAL_DATE";
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsEventRecord {
  eventId: string;
  eventType:
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
  path: string;
  referrer?: string;
  landingPage?: string;
  sessionId: string;
  anonymousVisitorId: string;
  userId?: string;
  customerEmail?: string;
  userAgent?: string;
  ipHash?: string;
  country?: string;
  region?: string;
  createdAt: string;
}

function now() { return new Date().toISOString(); }
function id() { return crypto.randomUUID(); }

export class DbConfigMissingError extends Error {
  code = "DB_CONFIG_MISSING" as const;
  missingEnvVars: string[];

  constructor(missingEnvVars: string[]) {
    super(`Missing required DB env vars: ${missingEnvVars.join(", ")}`);
    this.name = "DbConfigMissingError";
    this.missingEnvVars = missingEnvVars;
  }
}

interface DbWriteContext {
  correlationId?: string;
  operation: string;
  tableEnvVar: string;
  tableName: string;
}


interface TableKeySchemaInfo {
  partitionKeyName: string;
  sortKeyName?: string;
}

const tableKeySchemaCache = new Map<string, TableKeySchemaInfo>();



async function getTableKeySchema(tableName: string): Promise<TableKeySchemaInfo> {
  const cached = tableKeySchemaCache.get(tableName);
  if (cached) return cached;

  const result = await ddbClient.send(new DescribeTableCommand({ TableName: tableName }));
  const keySchema = result.Table?.KeySchema || [];
  const partition = keySchema.find((key) => key.KeyType === "HASH")?.AttributeName;
  if (!partition) {
    throw new Error(`Unable to resolve partition key for table: ${tableName}`);
  }
  const sort = keySchema.find((key) => key.KeyType === "RANGE")?.AttributeName;
  const schema: TableKeySchemaInfo = { partitionKeyName: partition, sortKeyName: sort };
  tableKeySchemaCache.set(tableName, schema);
  return schema;
}

async function applyTableKeySchema(item: Record<string, unknown>, ctx: DbWriteContext): Promise<Record<string, unknown>> {
  const schema = await getTableKeySchema(ctx.tableName);
  const next = { ...item };
  const idValue = typeof next.id === "string" ? next.id : crypto.randomUUID();

  if (next[schema.partitionKeyName] === undefined || next[schema.partitionKeyName] === null || next[schema.partitionKeyName] === "") {
    next[schema.partitionKeyName] = idValue;
  }

  if (schema.sortKeyName) {
    const existingSortValue = next[schema.sortKeyName];
    if (existingSortValue === undefined || existingSortValue === null || existingSortValue === "") {
      next[schema.sortKeyName] = `${ctx.operation}#${idValue}`;
    }
  }

  return next;
}

function assertDbWriteConfig() {
  const missing: string[] = REQUIRED_DB_ENV_VARS.filter((envName) => !process.env[envName]?.trim());
  const hasEffectiveRegion = Boolean(process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim());
  if (!hasEffectiveRegion) {
    missing.push("APP_AWS_REGION|AWS_REGION");
  }
  if (missing.length > 0) {
    throw new DbConfigMissingError([...missing]);
  }
}

async function putWithDiagnostics<T extends object>(item: T, ctx: DbWriteContext) {
  try {
    const itemWithKeys = await applyTableKeySchema(item as Record<string, unknown>, ctx);
    await ddb.send(new PutCommand({ TableName: ctx.tableName, Item: itemWithKeys }));
  } catch (error) {
    const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    console.error(
      JSON.stringify({
        level: "error",
        source: "db.write",
        correlationId: ctx.correlationId || null,
        operation: ctx.operation,
        tableEnvVar: ctx.tableEnvVar,
        tableName: ctx.tableName,
        awsErrorName: awsError?.name || "UnknownAwsError",
        awsErrorMessage: awsError?.message || "Unknown AWS SDK error",
        httpStatusCode: awsError?.$metadata?.httpStatusCode ?? null,
      })
    );
    throw error;
  }
}

async function deleteWithDiagnostics(idValue: string, ctx: DbWriteContext) {
  try {
    const schema = await getTableKeySchema(ctx.tableName);
    const key: Record<string, unknown> = { [schema.partitionKeyName]: idValue };
    if (schema.sortKeyName) {
      key[schema.sortKeyName] = `${ctx.operation}#${idValue}`;
    }
    await ddb.send(new DeleteCommand({ TableName: ctx.tableName, Key: key }));
  } catch (error) {
    const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    console.error(
      JSON.stringify({
        level: "error",
        source: "db.delete",
        correlationId: ctx.correlationId || null,
        operation: ctx.operation,
        tableEnvVar: ctx.tableEnvVar,
        tableName: ctx.tableName,
        awsErrorName: awsError?.name || "UnknownAwsError",
        awsErrorMessage: awsError?.message || "Unknown AWS SDK error",
        httpStatusCode: awsError?.$metadata?.httpStatusCode ?? null,
      })
    );
    throw error;
  }
}

export const db = {
  async findUserByEmail(email: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_USERS, FilterExpression: "email = :email", ExpressionAttributeValues: { ":email": email.toLowerCase() }, Limit: 1 }));
    return (result.Items?.[0] as UserRecord | undefined) || undefined;
  },

  async findUserById(userId: string) {
    const result = await ddb.send(new GetCommand({ TableName: TABLE_USERS, Key: { id: userId } }));
    return result.Item as UserRecord | undefined;
  },

  async createUser(user: Omit<UserRecord, "id" | "createdAt" | "updatedAt">, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const record: UserRecord = { ...user, id: id(), createdAt: now(), updatedAt: now() };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "createUser",
      tableEnvVar: "DDB_TABLE_USERS",
      tableName: TABLE_USERS,
    });
    return record;
  },

  async createCustomerProfile(profile: Omit<CustomerProfileRecord, "id" | "createdAt" | "updatedAt">, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const record: CustomerProfileRecord = { ...profile, id: id(), createdAt: now(), updatedAt: now() };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "createCustomerProfile",
      tableEnvVar: "DDB_TABLE_CUSTOMER_PROFILES",
      tableName: TABLE_CUSTOMER_PROFILES,
    });
    return record;
  },

  async getCustomerProfileByUserId(userId: string) {
    const result = await ddb.send(new ScanCommand({
      TableName: TABLE_CUSTOMER_PROFILES,
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      Limit: 1,
    }));
    return (result.Items?.[0] as CustomerProfileRecord | undefined) || undefined;
  },

  async createOrUpdateDriverProfile(input: Omit<DriverProfileRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const existing = await this.getDriverProfileByUserId(input.userId);
    const record: DriverProfileRecord = existing
      ? { ...existing, ...input, updatedAt: now() }
      : { ...input, id: id(), createdAt: now(), updatedAt: now() };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "createOrUpdateDriverProfile",
      tableEnvVar: "DDB_TABLE_DRIVER_PROFILES",
      tableName: TABLE_DRIVER_PROFILES,
    });
    return record;
  },

  async getDriverProfileByUserId(userId: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_DRIVER_PROFILES, FilterExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": userId }, Limit: 1 }));
    return (result.Items?.[0] as DriverProfileRecord | undefined) || undefined;
  },

  async getDriverProfileById(profileId: string) {
    const result = await ddb.send(new GetCommand({ TableName: TABLE_DRIVER_PROFILES, Key: { id: profileId } }));
    return result.Item as DriverProfileRecord | undefined;
  },

  async listDriverProfiles() {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_DRIVER_PROFILES }));
    return ((result.Items as DriverProfileRecord[] | undefined) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createDriverDocument(document: Omit<DriverDocumentRecord, "id" | "createdAt" | "updatedAt">, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const record: DriverDocumentRecord = { ...document, id: id(), createdAt: now(), updatedAt: now() };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "createDriverDocument",
      tableEnvVar: "DDB_TABLE_DRIVER_DOCUMENTS",
      tableName: TABLE_DRIVER_DOCUMENTS,
    });
    return record;
  },

  async updateDriverDocument(documentId: string, patch: Partial<DriverDocumentRecord>, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const existing = await this.getDriverDocumentById(documentId);
    if (!existing) return null;
    const record = { ...existing, ...patch, updatedAt: now() };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "updateDriverDocument",
      tableEnvVar: "DDB_TABLE_DRIVER_DOCUMENTS",
      tableName: TABLE_DRIVER_DOCUMENTS,
    });
    return record;
  },

  async getDriverDocumentById(documentId: string) {
    const result = await ddb.send(new GetCommand({ TableName: TABLE_DRIVER_DOCUMENTS, Key: { id: documentId } }));
    return result.Item as DriverDocumentRecord | undefined;
  },

  async listDriverDocumentsByUserId(userId: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_DRIVER_DOCUMENTS, FilterExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": userId } }));
    return ((result.Items as DriverDocumentRecord[] | undefined) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createDriverReminderLog(log: Omit<DriverReminderLogRecord, "id" | "sentAt">, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const record: DriverReminderLogRecord = { ...log, id: id(), sentAt: now() };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "createDriverReminderLog",
      tableEnvVar: "DDB_TABLE_DRIVER_REMINDER_LOGS",
      tableName: TABLE_DRIVER_REMINDER_LOGS,
    });
    return record;
  },

  async getDriverReminderLogByKey(reminderKey: string) {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_DRIVER_REMINDER_LOGS,
        FilterExpression: "reminderKey = :reminderKey",
        ExpressionAttributeValues: { ":reminderKey": reminderKey },
        Limit: 1,
      })
    );
    return (result.Items?.[0] as DriverReminderLogRecord | undefined) || undefined;
  },

  async createQuote(quote: Omit<QuoteRecord, "id" | "createdAt" | "updatedAt">, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const record: QuoteRecord = { ...quote, id: id(), createdAt: now(), updatedAt: now() };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "createQuote",
      tableEnvVar: "DDB_TABLE_QUOTES",
      tableName: TABLE_QUOTES,
    });
    return record;
  },

  async updateQuote(quoteId: string, patch: Partial<QuoteRecord>, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const current = await this.findQuoteById(quoteId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    await putWithDiagnostics(next, {
      correlationId: options?.correlationId,
      operation: "updateQuote",
      tableEnvVar: "DDB_TABLE_QUOTES",
      tableName: TABLE_QUOTES,
    });
    return next;
  },

  async findQuoteById(quoteId: string) {
    try {
      const schema = await getTableKeySchema(TABLE_QUOTES);
      if (schema.partitionKeyName === "id" && !schema.sortKeyName) {
        const result = await ddb.send(new GetCommand({ TableName: TABLE_QUOTES, Key: { id: quoteId } }));
        return result.Item as QuoteRecord | undefined;
      }
    } catch {
      // Fallback to scan path below when key schema lookup/get path is not compatible.
    }

    const fallback = await ddb.send(new ScanCommand({
      TableName: TABLE_QUOTES,
      FilterExpression: "#id = :id",
      ExpressionAttributeNames: { "#id": "id" },
      ExpressionAttributeValues: { ":id": quoteId },
      Limit: 1,
    }));
    return (fallback.Items?.[0] as QuoteRecord | undefined) || undefined;
  },

  async findQuotesByCustomer(userId: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_QUOTES, FilterExpression: "customerId = :customerId", ExpressionAttributeValues: { ":customerId": userId } }));
    return ((result.Items as QuoteRecord[] | undefined) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listQuotes() {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_QUOTES }));
    return ((result.Items as QuoteRecord[] | undefined) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async filterQuotes(filter: { status?: string; serviceType?: string; fromDate?: string; toDate?: string }) {
    const all = await this.listQuotes();
    return all.filter((q) => {
      if (filter.status && q.status !== filter.status) return false;
      if (filter.serviceType && q.serviceType !== filter.serviceType) return false;
      if (filter.fromDate && q.pickupDate < filter.fromDate) return false;
      if (filter.toDate && q.pickupDate > filter.toDate) return false;
      return true;
    });
  },

  async upsertBooking(quoteId: string, confirmed: boolean, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const existing = await this.getBookingForQuote(quoteId);
    if (!existing) {
      const record: BookingRecord = { id: id(), quoteId, confirmed, createdAt: now(), updatedAt: now() };
      await putWithDiagnostics(record, {
        correlationId: options?.correlationId,
        operation: "upsertBooking.create",
        tableEnvVar: "DDB_TABLE_BOOKINGS",
        tableName: TABLE_BOOKINGS,
      });
      return record;
    }
    const next = { ...existing, confirmed, updatedAt: now() };
    await putWithDiagnostics(next, {
      correlationId: options?.correlationId,
      operation: "upsertBooking.update",
      tableEnvVar: "DDB_TABLE_BOOKINGS",
      tableName: TABLE_BOOKINGS,
    });
    return next;
  },

  async getBookingForQuote(quoteId: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_BOOKINGS, FilterExpression: "quoteId = :quoteId", ExpressionAttributeValues: { ":quoteId": quoteId }, Limit: 1 }));
    return (result.Items?.[0] as BookingRecord | undefined) || undefined;
  },

  async createAudit(audit: Omit<QuoteAuditRecord, "id" | "createdAt">, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const record: QuoteAuditRecord = { ...audit, id: id(), createdAt: now() };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "createAudit",
      tableEnvVar: "DDB_TABLE_QUOTE_AUDITS",
      tableName: TABLE_QUOTE_AUDITS,
    });
    return record;
  },

  async getAuditsByQuote(quoteId: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_QUOTE_AUDITS, FilterExpression: "quoteId = :quoteId", ExpressionAttributeValues: { ":quoteId": quoteId } }));
    return ((result.Items as QuoteAuditRecord[] | undefined) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },


  async testQuoteTableWrite(options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const probeId = `health-${id()}`;
    const probeRecord: QuoteRecord = {
      id: probeId,
      accountType: "PERSONAL",
      serviceType: "HEALTH_CHECK",
      pickupLocation: "Health Check Pickup",
      dropoffLocation: "Health Check Dropoff",
      pickupDate: "2099-01-01",
      pickupTime: "00:00",
      passengers: 1,
      returnJourney: false,
      quotedCurrency: "GBP",
      status: "QUOTE_REQUESTED",
      createdAt: now(),
      updatedAt: now(),
      itineraryMessage: "Temporary admin health write-test record.",
      guestEmail: "healthcheck@example.com",
      guestName: "Health Check",
      guestPhone: "N/A",
      golfBags: 0,
      luggage: "",
    };

    await putWithDiagnostics(probeRecord, {
      correlationId: options?.correlationId,
      operation: "health.dbWriteTest.createQuote",
      tableEnvVar: "DDB_TABLE_QUOTES",
      tableName: TABLE_QUOTES,
    });

    const keySchema = await getTableKeySchema(TABLE_QUOTES);
    return {
      ok: true,
      tableName: TABLE_QUOTES,
      tableEnvVar: "DDB_TABLE_QUOTES",
      keySchema,
      probeId,
    };
  },


  async listPricingSettings() {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_PRICING_SETTINGS }));
    return ((result.Items as PricingSettingsRecord[] | undefined) || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getActivePricingSettings() {
    const settings = await this.listPricingSettings();
    return settings.find((s) => s.active) || settings[0] || null;
  },

  async upsertPricingSettings(input: Omit<PricingSettingsRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const existing = input.id ? (await this.listPricingSettings()).find((s) => s.id === input.id) : await this.getActivePricingSettings();
    const record: PricingSettingsRecord = existing
      ? { ...existing, ...input, updatedAt: now() }
      : { ...input, id: id(), createdAt: now(), updatedAt: now() };

    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "upsertPricingSettings",
      tableEnvVar: "DDB_TABLE_PRICING_SETTINGS",
      tableName: TABLE_PRICING_SETTINGS,
    });
    return record;
  },

  async listPricingTimeUplifts() {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_PRICING_TIME_UPLIFTS }));
    return ((result.Items as PricingTimeUpliftRecord[] | undefined) || []).sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  async replacePricingTimeUplifts(items: Array<Omit<PricingTimeUpliftRecord, "createdAt" | "updatedAt">>, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const existing = await this.listPricingTimeUplifts();
    const existingById = new Map(existing.map((item) => [item.id, item]));

    const records = items.map((item) => {
      const prior = existingById.get(item.id);
      return prior
        ? { ...prior, ...item, updatedAt: now() }
        : { ...item, createdAt: now(), updatedAt: now() };
    });

    for (const record of records) {
      await putWithDiagnostics(record, {
        correlationId: options?.correlationId,
        operation: "replacePricingTimeUplifts",
        tableEnvVar: "DDB_TABLE_PRICING_TIME_UPLIFTS",
        tableName: TABLE_PRICING_TIME_UPLIFTS,
      });
    }

    const keep = new Set(records.map((record) => record.id));
    for (const stale of existing.filter((item) => !keep.has(item.id))) {
      await deleteWithDiagnostics(stale.id, {
        correlationId: options?.correlationId,
        operation: "replacePricingTimeUplifts.delete",
        tableEnvVar: "DDB_TABLE_PRICING_TIME_UPLIFTS",
        tableName: TABLE_PRICING_TIME_UPLIFTS,
      });
    }

    return records;
  },

  async listPricingDateUplifts() {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_PRICING_DATE_UPLIFTS }));
    return ((result.Items as PricingDateUpliftRecord[] | undefined) || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async replacePricingDateUplifts(items: Array<Omit<PricingDateUpliftRecord, "createdAt" | "updatedAt">>, options?: { correlationId?: string }) {
    assertDbWriteConfig();
    const existing = await this.listPricingDateUplifts();
    const existingById = new Map(existing.map((item) => [item.id, item]));

    const records = items.map((item) => {
      const prior = existingById.get(item.id);
      return prior
        ? { ...prior, ...item, updatedAt: now() }
        : { ...item, createdAt: now(), updatedAt: now() };
    });

    for (const record of records) {
      await putWithDiagnostics(record, {
        correlationId: options?.correlationId,
        operation: "replacePricingDateUplifts",
        tableEnvVar: "DDB_TABLE_PRICING_DATE_UPLIFTS",
        tableName: TABLE_PRICING_DATE_UPLIFTS,
      });
    }

    const keep = new Set(records.map((record) => record.id));
    for (const stale of existing.filter((item) => !keep.has(item.id))) {
      await deleteWithDiagnostics(stale.id, {
        correlationId: options?.correlationId,
        operation: "replacePricingDateUplifts.delete",
        tableEnvVar: "DDB_TABLE_PRICING_DATE_UPLIFTS",
        tableName: TABLE_PRICING_DATE_UPLIFTS,
      });
    }

    return records;
  },

  async createAnalyticsEvent(event: Omit<AnalyticsEventRecord, "eventId" | "createdAt"> & { eventId?: string }, options?: { correlationId?: string }) {
    if (!TABLE_ANALYTICS_EVENTS) {
      throw new DbConfigMissingError(["DDB_TABLE_ANALYTICS_EVENTS"]);
    }
    const record: AnalyticsEventRecord = {
      ...event,
      eventId: event.eventId || id(),
      createdAt: now(),
    };
    await putWithDiagnostics(record, {
      correlationId: options?.correlationId,
      operation: "createAnalyticsEvent",
      tableEnvVar: "DDB_TABLE_ANALYTICS_EVENTS",
      tableName: TABLE_ANALYTICS_EVENTS,
    });
    return record;
  },

  async listAnalyticsEvents() {
    if (!TABLE_ANALYTICS_EVENTS) {
      throw new DbConfigMissingError(["DDB_TABLE_ANALYTICS_EVENTS"]);
    }
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_ANALYTICS_EVENTS }));
    return ((result.Items as AnalyticsEventRecord[] | undefined) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listCustomers() {
    const usersResult = await ddb.send(new ScanCommand({ TableName: TABLE_USERS, FilterExpression: "#role = :role", ExpressionAttributeNames: { "#role": "role" }, ExpressionAttributeValues: { ":role": "CUSTOMER" } }));
    const profilesResult = await ddb.send(new ScanCommand({ TableName: TABLE_CUSTOMER_PROFILES }));
    const quotes = await this.listQuotes();

    const users = (usersResult.Items as UserRecord[] | undefined) || [];
    const profiles = (profilesResult.Items as CustomerProfileRecord[] | undefined) || [];

    return users.map((u) => ({
      ...u,
      customerProfile: profiles.find((p) => p.userId === u.id),
      quotes: quotes.filter((q) => q.customerId === u.id).slice(0, 3),
    }));
  },
};
