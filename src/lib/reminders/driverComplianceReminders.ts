import { db, type DriverDocumentRecord, type DriverProfileRecord } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  adminDriverComplianceAlertEmail,
  driverDocumentExpiredEmail,
  driverDocumentExpiryWarningEmail,
  driverMissingComplianceReminderEmail,
} from "@/lib/email/templates";
import { DRIVER_DOCUMENT_TYPES } from "@/lib/driver/constants";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderType = "MISSING_ONBOARDING_48H" | "EXPIRY_6W" | "EXPIRY_4W" | "EXPIRY_2W" | "DOCUMENT_EXPIRED";

export interface DriverComplianceReminderSummary {
  driversScanned: number;
  remindersSent: number;
  missingOnboardingRemindersSent: number;
  expiryWarningsSent: number;
  expiredDocumentAlertsSent: number;
  documentsMarkedExpired: number;
  duplicateRemindersSkipped: number;
}

function normalizeType(type: string) {
  return type.replaceAll("_", " ").toLowerCase();
}

function daysUntil(dateString: string, nowMs: number) {
  const targetMs = new Date(`${dateString}T00:00:00.000Z`).getTime();
  return Math.ceil((targetMs - nowMs) / DAY_MS);
}

function getMissingProfileFields(profile: DriverProfileRecord) {
  const requiredFields: Array<keyof DriverProfileRecord> = [
    "name",
    "email",
    "mobile",
    "addressLine1",
    "city",
    "region",
    "postalCode",
    "country",
    "carMake",
    "carModel",
    "registrationNumber",
  ];
  const missing = requiredFields.filter((field) => !String(profile[field] ?? "").trim()).map((field) => String(field));
  if (profile.passengerCapacity <= 0) missing.push("passengerCapacity");
  if (profile.suitcaseCapacity <= 0) missing.push("suitcaseCapacity");
  return missing;
}

function getMissingDocuments(documents: DriverDocumentRecord[]) {
  return DRIVER_DOCUMENT_TYPES.filter((type) => !documents.some((doc) => doc.type === type));
}

async function recordAndSend(params: {
  reminderKey: string;
  reminderType: ReminderType;
  driverId: string;
  documentId?: string;
  to: string;
  subject: string;
  text: string;
}) {
  const existing = await db.getDriverReminderLogByKey(params.reminderKey);
  if (existing) return { sent: false, duplicate: true };

  await sendEmail({ to: params.to, subject: params.subject, text: params.text });
  await db.createDriverReminderLog({
    driverId: params.driverId,
    documentId: params.documentId || null,
    reminderType: params.reminderType,
    reminderKey: params.reminderKey,
  });

  return { sent: true, duplicate: false };
}

export async function runDriverComplianceReminders(): Promise<DriverComplianceReminderSummary> {
  const summary: DriverComplianceReminderSummary = {
    driversScanned: 0,
    remindersSent: 0,
    missingOnboardingRemindersSent: 0,
    expiryWarningsSent: 0,
    expiredDocumentAlertsSent: 0,
    documentsMarkedExpired: 0,
    duplicateRemindersSkipped: 0,
  };

  const now = new Date();
  const nowMs = now.getTime();
  const nowDate = now.toISOString().slice(0, 10);
  const reminderBucket = Math.floor(nowMs / FORTY_EIGHT_HOURS_MS);
  const profiles = await db.listDriverProfiles();
  summary.driversScanned = profiles.length;

  for (const profile of profiles) {
    const documents = await db.listDriverDocumentsByUserId(profile.userId);
    const missingProfileFields = getMissingProfileFields(profile);
    const missingDocuments = getMissingDocuments(documents);
    const isIncomplete = profile.status === "INCOMPLETE" || profile.status === "PENDING" || missingProfileFields.length > 0 || missingDocuments.length > 0;

    if (isIncomplete) {
      const reminderKey = `missing:${profile.id}:${reminderBucket}`;
      const driverEmail = driverMissingComplianceReminderEmail({
        driverName: profile.name,
        missingProfileFields,
        missingDocuments,
      });
      const sent = await recordAndSend({
        reminderKey,
        reminderType: "MISSING_ONBOARDING_48H",
        driverId: profile.id,
        to: profile.email,
        subject: driverEmail.subject,
        text: driverEmail.text,
      });

      if (sent.sent) {
        summary.remindersSent += 1;
        summary.missingOnboardingRemindersSent += 1;
        if (ADMIN_EMAIL) {
          const adminEmail = adminDriverComplianceAlertEmail({
            driverName: profile.name,
            driverEmail: profile.email,
            alertType: "MISSING_ONBOARDING",
            details: `Missing profile fields: ${missingProfileFields.join(", ") || "None"}\nMissing documents: ${missingDocuments.join(", ") || "None"}`,
          });
          await sendEmail({ to: ADMIN_EMAIL, subject: adminEmail.subject, text: adminEmail.text });
        }
      } else if (sent.duplicate) {
        summary.duplicateRemindersSkipped += 1;
      }
    }

    for (const document of documents) {
      if (!document.expiryDate) continue;
      const docTypeLabel = normalizeType(document.type);
      const dueInDays = daysUntil(document.expiryDate, nowMs);

      if (document.expiryDate < nowDate && document.status !== "EXPIRED") {
        await db.updateDriverDocument(document.id, { status: "EXPIRED", reviewedAt: new Date().toISOString() });
        summary.documentsMarkedExpired += 1;
      }

      if (document.expiryDate < nowDate) {
        const reminderKey = `expired:${document.id}:${document.expiryDate}`;
        const driverEmail = driverDocumentExpiredEmail({
          driverName: profile.name,
          documentType: docTypeLabel,
          expiryDate: document.expiryDate,
        });
        const sent = await recordAndSend({
          reminderKey,
          reminderType: "DOCUMENT_EXPIRED",
          driverId: profile.id,
          documentId: document.id,
          to: profile.email,
          subject: driverEmail.subject,
          text: driverEmail.text,
        });

        if (sent.sent) {
          summary.remindersSent += 1;
          summary.expiredDocumentAlertsSent += 1;
          if (ADMIN_EMAIL) {
            const adminEmail = adminDriverComplianceAlertEmail({
              driverName: profile.name,
              driverEmail: profile.email,
              alertType: "DOCUMENT_EXPIRED",
              details: `Expired document: ${docTypeLabel}\nExpiry date: ${document.expiryDate}`,
            });
            await sendEmail({ to: ADMIN_EMAIL, subject: adminEmail.subject, text: adminEmail.text });
          }
        } else if (sent.duplicate) {
          summary.duplicateRemindersSkipped += 1;
        }
        continue;
      }

      const windows: Array<{ days: number; weeks: 6 | 4 | 2; type: ReminderType }> = [
        { days: 42, weeks: 6, type: "EXPIRY_6W" },
        { days: 28, weeks: 4, type: "EXPIRY_4W" },
        { days: 14, weeks: 2, type: "EXPIRY_2W" },
      ];
      const match = windows.find((item) => dueInDays === item.days);
      if (!match) continue;

      const reminderKey = `expiry:${document.id}:${match.type}:${document.expiryDate}`;
      const driverEmail = driverDocumentExpiryWarningEmail({
        driverName: profile.name,
        documentType: docTypeLabel,
        expiryDate: document.expiryDate,
        weeksBefore: match.weeks,
      });
      const sent = await recordAndSend({
        reminderKey,
        reminderType: match.type,
        driverId: profile.id,
        documentId: document.id,
        to: profile.email,
        subject: driverEmail.subject,
        text: driverEmail.text,
      });

      if (sent.sent) {
        summary.remindersSent += 1;
        summary.expiryWarningsSent += 1;
        if (ADMIN_EMAIL) {
          const adminEmail = adminDriverComplianceAlertEmail({
            driverName: profile.name,
            driverEmail: profile.email,
            alertType: "EXPIRY_WARNING",
            details: `${docTypeLabel} expires on ${document.expiryDate} (${match.weeks} weeks warning).`,
          });
          await sendEmail({ to: ADMIN_EMAIL, subject: adminEmail.subject, text: adminEmail.text });
        }
      } else if (sent.duplicate) {
        summary.duplicateRemindersSkipped += 1;
      }
    }
  }

  return summary;
}
