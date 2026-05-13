import { SquareClient, SquareEnvironment } from "square";

function resolveSquareEnvironment() {
  return process.env.SQUARE_ENVIRONMENT?.trim().toLowerCase() === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
}

export function getSquareClient() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("SQUARE_CONFIG_MISSING_ACCESS_TOKEN");
  }

  return new SquareClient({
    token: accessToken,
    environment: resolveSquareEnvironment(),
  });
}

export function getSquareLocationId() {
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();
  if (!locationId) {
    throw new Error("SQUARE_CONFIG_MISSING_LOCATION_ID");
  }
  return locationId;
}

export function toMinorUnits(amount: number) {
  return BigInt(Math.round(amount * 100));
}
