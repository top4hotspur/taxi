import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { resolveDriverPhotosBucketConfig, uploadDriverPhoto } from "@/lib/storage/driverPhotos";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, errorCode: "FORBIDDEN", message: "Forbidden" }, { status: 403 });
  }

  const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || "eu-west-2";
  const bucketConfig = resolveDriverPhotosBucketConfig();
  let fileReceived = false;
  let fileMimeType = "";
  let fileSizeBytes = 0;

  function diagnostics(extra?: {
    s3ErrorName?: string | null;
    s3ErrorCode?: string | null;
    s3StatusCode?: number | null;
  }) {
    return {
      bucketConfigured: Boolean(bucketConfig.bucket),
      bucketNamePresent: Boolean(bucketConfig.bucket),
      bucketName: bucketConfig.bucket || null,
      region,
      fileReceived,
      fileMimeType,
      fileSizeBytes,
      s3ErrorName: extra?.s3ErrorName ?? null,
      s3ErrorCode: extra?.s3ErrorCode ?? null,
      s3StatusCode: extra?.s3StatusCode ?? null,
    };
  }

  try {
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, errorCode: "PHOTO_REQUIRED", message: "Please choose a photo to upload.", diagnostics: diagnostics() },
        { status: 400 }
      );
    }

    const mime = file.type;
    fileReceived = true;
    fileMimeType = mime;
    fileSizeBytes = file.size;

    if (!ALLOWED[mime]) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "PHOTO_TYPE_NOT_ALLOWED",
          message: "Only JPG, PNG or WebP images are allowed.",
          diagnostics: diagnostics(),
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "PHOTO_TOO_LARGE",
          message: "Photo is too large. Maximum size is 5MB.",
          diagnostics: diagnostics(),
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const ext = ALLOWED[mime] || path.extname(file.name).replace(".", "") || "jpg";
    const uploaded = await uploadDriverPhoto({
      fileBuffer: Buffer.from(bytes),
      contentType: mime,
      extension: ext,
    });

    return NextResponse.json({ ok: true, ...uploaded });
  } catch (error) {
    const awsError = error as {
      name?: string;
      code?: string;
      message?: string;
      $metadata?: { httpStatusCode?: number };
    };
    const msg = error instanceof Error ? error.message : "Upload failed";
    const s3ErrorName = awsError?.name || null;
    const s3ErrorCode = awsError?.code || awsError?.name || null;
    const s3StatusCode = awsError?.$metadata?.httpStatusCode ?? null;

    if (msg === "DRIVER_PHOTOS_BUCKET_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "DRIVER_PHOTOS_BUCKET_NOT_CONFIGURED",
          message: "Driver photo upload is not configured.",
          diagnostics: diagnostics({ s3ErrorName, s3ErrorCode, s3StatusCode }),
        },
        { status: 503 }
      );
    }

    if (s3ErrorName === "NoSuchBucket") {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "DRIVER_PHOTO_BUCKET_MISSING",
          message: "Driver photo bucket does not exist.",
          diagnostics: diagnostics({ s3ErrorName, s3ErrorCode, s3StatusCode }),
        },
        { status: 503 }
      );
    }

    if (s3ErrorName === "AccessDenied") {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "DRIVER_PHOTO_UPLOAD_FORBIDDEN",
          message: "Server does not have permission to upload driver photos.",
          diagnostics: diagnostics({ s3ErrorName, s3ErrorCode, s3StatusCode }),
        },
        { status: 503 }
      );
    }

    if (s3ErrorName === "PermanentRedirect" || s3ErrorName === "AuthorizationHeaderMalformed") {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "DRIVER_PHOTO_BUCKET_REGION_MISMATCH",
          message: "Driver photo bucket is in a different AWS region.",
          diagnostics: diagnostics({ s3ErrorName, s3ErrorCode, s3StatusCode }),
        },
        { status: 503 }
      );
    }

    if (s3ErrorName === "EntityTooLarge") {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "PHOTO_TOO_LARGE",
          message: "Photo is too large. Maximum size is 5MB.",
          diagnostics: diagnostics({ s3ErrorName, s3ErrorCode, s3StatusCode }),
        },
        { status: 400 }
      );
    }

    console.error(
      JSON.stringify({
        level: "error",
        source: "api.admin.drivers.photo",
        message: msg || "Upload failed",
        s3ErrorName,
        s3ErrorCode,
        s3StatusCode,
        bucketName: bucketConfig.bucket || null,
        region,
      })
    );
    return NextResponse.json(
      {
        ok: false,
        errorCode: "DRIVER_PHOTO_UPLOAD_FAILED",
        message: "Driver photo upload failed. Please try again.",
        diagnostics: diagnostics({ s3ErrorName, s3ErrorCode, s3StatusCode }),
      },
      { status: 500 }
    );
  }
}
