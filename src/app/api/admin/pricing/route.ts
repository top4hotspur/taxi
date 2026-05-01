import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db, type PricingDateUpliftRecord, type PricingTimeUpliftRecord } from "@/lib/db";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { getEffectivePricingConfig } from "@/lib/pricing/settings";

interface PricingPayload {
  settings: {
    id?: string;
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
  };
  timeUplifts: Array<{
    id?: string;
    label: string;
    startTime: string;
    endTime: string;
    upliftPercent: number;
    active: boolean;
  }>;
  dateUplifts: Array<{
    id?: string;
    label: string;
    upliftPercent: number;
    active: boolean;
    ruleType: "SINGLE_DATE" | "DATE_RANGE" | "RECURRING_ANNUAL_DATE";
    date?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const config = await getEffectivePricingConfig();
  return NextResponse.json({ ok: true, ...config });
}

export async function PUT(request: Request) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as PricingPayload;

  const settings = await db.upsertPricingSettings({
    id: payload.settings.id,
    baseFare: Number(payload.settings.baseFare),
    perMile: Number(payload.settings.perMile),
    perMinute: Number(payload.settings.perMinute),
    minimumFare: Number(payload.settings.minimumFare),
    currency: String(payload.settings.currency || "GBP"),
    airportSurchargeAmount: Number(payload.settings.airportSurchargeAmount || 5),
    standardPassengerMax: Number(payload.settings.standardPassengerMax || 4),
    passengerBand_5_6_UpliftPercent: Number(payload.settings.passengerBand_5_6_UpliftPercent || 0),
    passengerBand_7_8_UpliftPercent: Number(payload.settings.passengerBand_7_8_UpliftPercent || 0),
    airportUpliftPercent: Number(payload.settings.airportUpliftPercent || 0),
    dublinAirportUpliftPercent: Number(payload.settings.dublinAirportUpliftPercent || 0),
    golfBagSurcharge: Number(payload.settings.golfBagSurcharge || 0),
    largeLuggageSurcharge: Number(payload.settings.largeLuggageSurcharge || 0),
    active: payload.settings.active !== false,
  });

  const timeUplifts: Array<Omit<PricingTimeUpliftRecord, "createdAt" | "updatedAt">> = payload.timeUplifts.map((rule) => ({
    id: rule.id || crypto.randomUUID(),
    label: rule.label,
    startTime: rule.startTime,
    endTime: rule.endTime,
    upliftPercent: Number(rule.upliftPercent || 0),
    active: Boolean(rule.active),
  }));

  const dateUplifts: Array<Omit<PricingDateUpliftRecord, "createdAt" | "updatedAt">> = payload.dateUplifts.map((rule) => ({
    id: rule.id || crypto.randomUUID(),
    label: rule.label,
    upliftPercent: Number(rule.upliftPercent || 0),
    active: Boolean(rule.active),
    ruleType: rule.ruleType,
    date: rule.date || null,
    startDate: rule.startDate || null,
    endDate: rule.endDate || null,
  }));

  const savedTimeUplifts = await db.replacePricingTimeUplifts(timeUplifts);
  const savedDateUplifts = await db.replacePricingDateUplifts(dateUplifts);

  return NextResponse.json({
    ok: true,
    settings,
    timeUplifts: savedTimeUplifts,
    dateUplifts: savedDateUplifts,
  });
}
