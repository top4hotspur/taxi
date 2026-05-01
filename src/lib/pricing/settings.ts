import { db, type PricingDateUpliftRecord, type PricingSettingsRecord, type PricingTimeUpliftRecord } from "@/lib/db";

export interface EffectivePricingConfig {
  settings: PricingSettingsRecord;
  timeUplifts: PricingTimeUpliftRecord[];
  dateUplifts: PricingDateUpliftRecord[];
}

const DEFAULT_SETTINGS: PricingSettingsRecord = {
  id: "default-pricing-settings",
  baseFare: 10,
  perMile: 2.2,
  perMinute: 0.35,
  minimumFare: 25,
  currency: "GBP",
  active: true,
  airportUpliftPercent: 0,
  dublinAirportUpliftPercent: 0,
  golfBagSurcharge: 0,
  largeLuggageSurcharge: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const DEFAULT_TIME_BANDS: PricingTimeUpliftRecord[] = [
  { id: "band-1", label: "00:01-06:00", startTime: "00:01", endTime: "06:00", upliftPercent: 0, active: false, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
  { id: "band-2", label: "06:01-12:00", startTime: "06:01", endTime: "12:00", upliftPercent: 0, active: false, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
  { id: "band-3", label: "12:01-18:00", startTime: "12:01", endTime: "18:00", upliftPercent: 0, active: false, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
  { id: "band-4", label: "18:01-00:00", startTime: "18:01", endTime: "00:00", upliftPercent: 0, active: false, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
];

export async function getEffectivePricingConfig(): Promise<EffectivePricingConfig> {
  const settings = (await db.getActivePricingSettings()) || DEFAULT_SETTINGS;
  const fetchedTimeUplifts = await db.listPricingTimeUplifts();
  const timeUplifts = fetchedTimeUplifts.length ? fetchedTimeUplifts : DEFAULT_TIME_BANDS;
  const dateUplifts = await db.listPricingDateUplifts();

  return { settings, timeUplifts, dateUplifts };
}
