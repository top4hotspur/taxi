import crypto from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-1";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const TABLE_USERS = process.env.DDB_TABLE_USERS || "NITaxiUsers";
const TABLE_CUSTOMER_PROFILES = process.env.DDB_TABLE_CUSTOMER_PROFILES || "NITaxiCustomerProfiles";
const TABLE_QUOTES = process.env.DDB_TABLE_QUOTES || "NITaxiQuotes";
const TABLE_BOOKINGS = process.env.DDB_TABLE_BOOKINGS || "NITaxiBookings";
const TABLE_QUOTE_AUDITS = process.env.DDB_TABLE_QUOTE_AUDITS || "NITaxiQuoteAudits";

type Role = "CUSTOMER" | "ADMIN" | "DRIVER";

export interface UserRecord { id: string; email: string; passwordHash: string; role: Role; createdAt: string; updatedAt: string }
export interface CustomerProfileRecord { id: string; userId: string; accountType: string; name: string; phone: string; country: string; addressLine1: string; addressLine2?: string | null; city: string; region: string; postalCode: string; addressCountry: string; businessName?: string | null; tourOperatorName?: string | null; website?: string | null; taxIdVatNumber?: string | null; createdAt: string; updatedAt: string }
export interface QuoteRecord { id: string; customerId?: string; guestEmail?: string; guestName?: string; guestPhone?: string; accountType: string; serviceType: string; pickupLocation: string; dropoffLocation: string; pickupDate: string; pickupTime: string; passengers: number; luggage?: string; golfBags?: number; returnJourney: boolean; itineraryMessage?: string; adminNotes?: string; quotedPrice?: number; quotedCurrency: string; status: string; createdAt: string; updatedAt: string }
export interface BookingRecord { id: string; quoteId: string; confirmed: boolean; createdAt: string; updatedAt: string }
export interface QuoteAuditRecord { id: string; quoteId: string; changedByRole: string; changedByUserId?: string; previousStatus?: string; newStatus: string; note?: string; createdAt: string }

function now() { return new Date().toISOString(); }
function id() { return crypto.randomUUID(); }

export const db = {
  async findUserByEmail(email: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_USERS, FilterExpression: "email = :email", ExpressionAttributeValues: { ":email": email.toLowerCase() }, Limit: 1 }));
    return (result.Items?.[0] as UserRecord | undefined) || undefined;
  },

  async findUserById(userId: string) {
    const result = await ddb.send(new GetCommand({ TableName: TABLE_USERS, Key: { id: userId } }));
    return result.Item as UserRecord | undefined;
  },

  async createUser(user: Omit<UserRecord, "id" | "createdAt" | "updatedAt">) {
    const record: UserRecord = { ...user, id: id(), createdAt: now(), updatedAt: now() };
    await ddb.send(new PutCommand({ TableName: TABLE_USERS, Item: record }));
    return record;
  },

  async createCustomerProfile(profile: Omit<CustomerProfileRecord, "id" | "createdAt" | "updatedAt">) {
    const record: CustomerProfileRecord = { ...profile, id: id(), createdAt: now(), updatedAt: now() };
    await ddb.send(new PutCommand({ TableName: TABLE_CUSTOMER_PROFILES, Item: record }));
    return record;
  },

  async createQuote(quote: Omit<QuoteRecord, "id" | "createdAt" | "updatedAt">) {
    const record: QuoteRecord = { ...quote, id: id(), createdAt: now(), updatedAt: now() };
    await ddb.send(new PutCommand({ TableName: TABLE_QUOTES, Item: record }));
    return record;
  },

  async updateQuote(quoteId: string, patch: Partial<QuoteRecord>) {
    const current = await this.findQuoteById(quoteId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    await ddb.send(new PutCommand({ TableName: TABLE_QUOTES, Item: next }));
    return next;
  },

  async findQuoteById(quoteId: string) {
    const result = await ddb.send(new GetCommand({ TableName: TABLE_QUOTES, Key: { id: quoteId } }));
    return result.Item as QuoteRecord | undefined;
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

  async upsertBooking(quoteId: string, confirmed: boolean) {
    const existing = await this.getBookingForQuote(quoteId);
    if (!existing) {
      const record: BookingRecord = { id: id(), quoteId, confirmed, createdAt: now(), updatedAt: now() };
      await ddb.send(new PutCommand({ TableName: TABLE_BOOKINGS, Item: record }));
      return record;
    }
    const next = { ...existing, confirmed, updatedAt: now() };
    await ddb.send(new PutCommand({ TableName: TABLE_BOOKINGS, Item: next }));
    return next;
  },

  async getBookingForQuote(quoteId: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_BOOKINGS, FilterExpression: "quoteId = :quoteId", ExpressionAttributeValues: { ":quoteId": quoteId }, Limit: 1 }));
    return (result.Items?.[0] as BookingRecord | undefined) || undefined;
  },

  async createAudit(audit: Omit<QuoteAuditRecord, "id" | "createdAt">) {
    const record: QuoteAuditRecord = { ...audit, id: id(), createdAt: now() };
    await ddb.send(new PutCommand({ TableName: TABLE_QUOTE_AUDITS, Item: record }));
    return record;
  },

  async getAuditsByQuote(quoteId: string) {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_QUOTE_AUDITS, FilterExpression: "quoteId = :quoteId", ExpressionAttributeValues: { ":quoteId": quoteId } }));
    return ((result.Items as QuoteAuditRecord[] | undefined) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
