import { NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { checkDriverPhotoBucketAccess, getDriverPhotosBucket } from "@/lib/storage/driverPhotos";

// TODO: Remove or lock down this diagnostic endpoint before production launch.

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const bucketPresent = Boolean(process.env.DRIVER_PHOTOS_BUCKET?.trim());
  if (!bucketPresent) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "DRIVER_PHOTOS_BUCKET_NOT_CONFIGURED",
        message: "Driver photo upload is not configured.",
        diagnostics: {
          bucketConfigured: false,
          bucketNamePresent: false,
        },
      },
      { status: 503 }
    );
  }

  const accessCheck = await checkDriverPhotoBucketAccess();
  if (!accessCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "DRIVER_PHOTO_BUCKET_ACCESS_FAILED",
        message: "Driver photo storage is unavailable.",
        diagnostics: {
          bucketConfigured: true,
          bucketNamePresent: true,
          bucketName: accessCheck.bucket,
          stage: accessCheck.stage,
          s3ErrorCode: accessCheck.s3ErrorCode,
          s3StatusCode: accessCheck.s3StatusCode,
        },
      },
      { status: 503 }
    );
  }

  const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || "eu-west-2";
  const accessKeyId = process.env.APP_AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.APP_AWS_SECRET_ACCESS_KEY?.trim();
  const s3Client = new S3Client({
    region,
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }
      : {}),
  });
  const bucket = getDriverPhotosBucket();
  const testKey = `drivers/diag-${crypto.randomUUID()}.txt`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: "driver-photo-storage-test",
        ContentType: "text/plain",
      })
    );
  } catch (error) {
    const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    return NextResponse.json(
      {
        ok: false,
        errorCode: "DRIVER_PHOTO_UPLOAD_FAILED",
        message: "Driver photo storage write test failed.",
        diagnostics: {
          bucketName: bucket,
          stage: "PUT_OBJECT",
          s3ErrorCode: awsError?.name || null,
          s3StatusCode: awsError?.$metadata?.httpStatusCode ?? null,
        },
      },
      { status: 503 }
    );
  }

  let deleteAttempted = false;
  try {
    deleteAttempted = true;
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: testKey,
      })
    );
  } catch (error) {
    const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    return NextResponse.json(
      {
        ok: false,
        errorCode: "DRIVER_PHOTO_DELETE_FAILED",
        message: "Driver photo storage cleanup failed.",
        diagnostics: {
          bucketName: bucket,
          stage: "DELETE_OBJECT",
          s3ErrorCode: awsError?.name || null,
          s3StatusCode: awsError?.$metadata?.httpStatusCode ?? null,
          deleteAttempted,
        },
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Driver photo storage is configured and writable.",
    diagnostics: {
      bucketName: bucket,
      writeTestKey: testKey,
      deleteAttempted,
    },
  });
}
