import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  const required = ["email","password","name","phone","country","addressLine1","city","region","postalCode","addressCountry"];
  for (const field of required) if (!body[field]?.trim()) return NextResponse.json({ success: false, message: `Missing required field: ${field}` }, { status: 400 });

  const existing = await db.findUserByEmail(body.email);
  if (existing) return NextResponse.json({ success: false, message: "Email already in use." }, { status: 409 });

  const user = await db.createUser({ email: body.email.toLowerCase(), passwordHash: hashPassword(body.password), role: "CUSTOMER" });
  await db.createCustomerProfile({ userId: user.id, accountType: body.accountType === "BUSINESS" ? "BUSINESS" : "PERSONAL", name: body.name, phone: body.phone, country: body.country, addressLine1: body.addressLine1, addressLine2: body.addressLine2 || null, city: body.city, region: body.region, postalCode: body.postalCode, addressCountry: body.addressCountry, businessName: body.businessName || null, tourOperatorName: body.tourOperatorName || null, website: body.website || null, taxIdVatNumber: body.taxIdVatNumber || null });

  const token = createSessionToken({ userId: user.id, email: user.email, role: "customer" });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, token, sessionCookie.options);

  return NextResponse.json({ success: true });
}
