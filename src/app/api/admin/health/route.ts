import { NextResponse } from "next/server";
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { createServerDynamoClient } from "@/lib/db";
import { checkDriverPhotoBucketAccess, resolveDriverPhotosBucketConfig } from "@/lib/storage/driverPhotos";
import { getTwilioNotificationHealth } from "@/lib/notifications/twilio";

const dbEnvVars = [
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
  "DDB_TABLE_ANALYTICS_EVENTS",
] as const;

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const ddbTables = Object.fromEntries(dbEnvVars.map((name) => [name, Boolean(process.env[name]?.trim())]));
  const ddbClient = createServerDynamoClient();
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
  const emailProvider = process.env.EMAIL_PROVIDER?.trim() || "";
  const resendApiKeyPresent = Boolean(process.env.RESEND_API_KEY?.trim());
  const emailFromPresent = Boolean(process.env.EMAIL_FROM?.trim());
  const adminEmailPresent = Boolean(process.env.ADMIN_EMAIL?.trim());
  const emailConfigured = Boolean(emailProvider && resendApiKeyPresent && emailFromPresent && adminEmailPresent);
  const emailGuidance =
    emailProvider === "resend"
      ? "Check Resend dashboard logs and domain/sender verification if email sends fail."
      : "Email provider not configured.";
  const emailDeliverabilityGuidance =
    "Verify Resend DNS, SPF/DKIM/DMARC, and use a verified EMAIL_FROM domain. Customers may still need to check junk/spam.";
  const squareEnvironment = process.env.SQUARE_ENVIRONMENT?.trim().toLowerCase() || "missing";
  const squareAccessTokenPresent = Boolean(process.env.SQUARE_ACCESS_TOKEN?.trim());
  const squareLocationIdPresent = Boolean(process.env.SQUARE_LOCATION_ID?.trim());
  const squareApplicationId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID?.trim() || "";
  const squareClientLocationIdPresent = Boolean(process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim());
  const squareApplicationIdPresent = Boolean(squareApplicationId);
  const squareModeValid = squareEnvironment === "sandbox" || squareEnvironment === "production";
  const sandboxAppId = squareApplicationId.toLowerCase().startsWith("sandbox-");
  const productionAppId = squareApplicationId.toLowerCase().startsWith("sq0idp-");
  const squareModeAppIdMatch =
    !squareApplicationIdPresent ||
    (squareEnvironment === "sandbox" && sandboxAppId) ||
    (squareEnvironment === "production" && productionAppId);
  const squareServerConfigured = squareModeValid && squareAccessTokenPresent && squareLocationIdPresent;
  const squareClientConfigured = squareApplicationIdPresent && squareClientLocationIdPresent && squareModeAppIdMatch;
  const twilioHealth = getTwilioNotificationHealth();
  const whatsappTemplateGuidance =
    twilioHealth.whatsappNotificationsEnabled &&
    (!twilioHealth.customerWhatsAppTemplatePresent || !twilioHealth.driverWhatsAppTemplatePresent)
      ? "WhatsApp is enabled but template SID env vars are missing. Add TWILIO_WHATSAPP_CUSTOMER_DRIVER_TEMPLATE_SID and TWILIO_WHATSAPP_DRIVER_JOB_TEMPLATE_SID, then redeploy."
      : null;
  const driverPhotosBucketResolution = resolveDriverPhotosBucketConfig();
  const driverPhotosBucketPresent = Boolean(driverPhotosBucketResolution.bucket);
  const driverPhotosBucketName = driverPhotosBucketResolution.bucket;
  const driverTableNamePresent = Boolean(process.env.DDB_TABLE_DRIVER_PROFILES?.trim());
  const driverTableConfigured = ddbTableChecks.some(
    (check) => check.envVar === "DDB_TABLE_DRIVER_PROFILES" && check.configured && check.exists
  );
  const driverPhotoUploadConfigured = driverPhotosBucketPresent;
  const driverPhotoStorageCheck = driverPhotosBucketPresent
    ? await checkDriverPhotoBucketAccess()
    : {
        ok: false,
        stage: "NOT_CONFIGURED",
        bucket: null,
        s3ErrorCode: "DRIVER_PHOTOS_BUCKET_NOT_CONFIGURED",
        s3ErrorMessage: "Driver photos bucket is not configured.",
        s3StatusCode: null,
      };

  return NextResponse.json({
    ok: true,
    sessionRole: user?.role ?? null,
    appAwsRegionPresent: Boolean(process.env.APP_AWS_REGION?.trim()),
    effectiveRegionPresent: Boolean(process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim()),
    appAwsAccessKeyIdPresent: Boolean(process.env.APP_AWS_ACCESS_KEY_ID?.trim()),
    appAwsSecretAccessKeyPresent: Boolean(process.env.APP_AWS_SECRET_ACCESS_KEY?.trim()),
    ddbTables,
    ddbTableChecks,
    analyticsTableEnvPresent: Boolean(process.env.DDB_TABLE_ANALYTICS_EVENTS?.trim()),
    analyticsTableConfig: {
      envVar: "DDB_TABLE_ANALYTICS_EVENTS",
      present: Boolean(process.env.DDB_TABLE_ANALYTICS_EVENTS?.trim()),
      recommendedValue: "ni-taxi-analytics-events",
      expectedSchema: "day:String, createdAtEventId:String",
    },
    awsRegionInUse: process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim() || "eu-west-2",
    pricingTableEnvPresent: {
      settings: Boolean(process.env.DDB_TABLE_PRICING_SETTINGS?.trim()),
      timeUplifts: Boolean(process.env.DDB_TABLE_PRICING_TIME_UPLIFTS?.trim()),
      dateUplifts: Boolean(process.env.DDB_TABLE_PRICING_DATE_UPLIFTS?.trim()),
    },
    emailProvider,
    resendApiKeyPresent,
    emailFromPresent,
    adminEmailPresent,
    emailConfigured,
    emailGuidance,
    emailDeliverabilityGuidance,
    googleMapsPublicKeyPresent: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()),
    googleRoutesApiKeyPresent: Boolean(process.env.GOOGLE_ROUTES_API_KEY?.trim()),
    squareAccessTokenPresent,
    squareLocationIdPresent,
    squareEnvironment,
    squareApplicationIdPresent,
    squareClientLocationIdPresent,
    squareModeValid,
    squareServerConfigured,
    squareClientConfigured,
    squareModeAppIdMatch,
    smsConfigured: twilioHealth.twilioAccountSidPresent && twilioHealth.twilioAuthTokenPresent && twilioHealth.smsFromNumberPresent,
    twilioAccountSidPresent: twilioHealth.twilioAccountSidPresent,
    twilioAuthTokenPresent: twilioHealth.twilioAuthTokenPresent,
    twilioFromNumberPresent: twilioHealth.smsFromNumberPresent,
    smsFromNumberPresent: twilioHealth.smsFromNumberPresent,
    whatsappFromPresent: twilioHealth.whatsappFromPresent,
    whatsappNotificationsEnabled: twilioHealth.whatsappNotificationsEnabled,
    customerWhatsAppTemplatePresent: twilioHealth.customerWhatsAppTemplatePresent,
    driverWhatsAppTemplatePresent: twilioHealth.driverWhatsAppTemplatePresent,
    customerWhatsAppTemplateSidPresent: twilioHealth.customerWhatsAppTemplatePresent,
    driverWhatsAppTemplateSidPresent: twilioHealth.driverWhatsAppTemplatePresent,
    twilioStatusCallbackConfigured: twilioHealth.twilioStatusCallbackConfigured,
    twilioStatusCallbackUrl: twilioHealth.twilioStatusCallbackUrl,
    twilioWebhookSignatureVerificationEnabled: twilioHealth.twilioWebhookSignatureVerificationEnabled,
    whatsappConfigured: twilioHealth.whatsappConfigured,
    whatsappTemplateGuidance,
    driverPhotosBucketPresent,
    driverPhotosBucketName,
    driverPhotosBucketSource: driverPhotosBucketResolution.source,
    driverPhotosBucketEnvPresent: driverPhotosBucketResolution.driverPhotosBucketPresent,
    appDriverPhotosBucketEnvPresent: driverPhotosBucketResolution.appDriverPhotosBucketPresent,
    driverTableConfigured,
    driverTableNamePresent,
    driverPhotosBucketConfigured: driverPhotosBucketPresent,
    driverPhotoUploadConfigured,
    driverPhotoStorageCheck,
  });
}
