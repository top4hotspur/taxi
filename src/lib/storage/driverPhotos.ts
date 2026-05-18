import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || "eu-west-2";
const accessKeyId = process.env.APP_AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.APP_AWS_SECRET_ACCESS_KEY?.trim();

function createS3Client() {
  return new S3Client({
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
}

export function getDriverPhotosBucket() {
  const bucket = process.env.DRIVER_PHOTOS_BUCKET?.trim();
  if (!bucket) throw new Error("DRIVER_PHOTOS_BUCKET_NOT_CONFIGURED");
  return bucket;
}

export async function getDriverPhotoSignedUrl(photoKey: string, expiresInSeconds = 3600) {
  const key = photoKey.trim();
  if (!key) return null;
  const bucket = getDriverPhotosBucket();
  const client = createS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
}

export async function resolveDriverPhotoUrl(params: { photoKey?: string | null; photoUrl?: string | null }) {
  const photoKey = params.photoKey?.trim();
  if (photoKey) {
    try {
      const signed = await getDriverPhotoSignedUrl(photoKey);
      if (signed) return signed;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "warn",
          source: "driverPhotos.resolveDriverPhotoUrl",
          message: error instanceof Error ? error.message : "Failed to sign driver photo URL",
        })
      );
    }
  }
  return params.photoUrl?.trim() || null;
}

export async function checkDriverPhotoBucketAccess() {
  const bucket = getDriverPhotosBucket();
  const client = createS3Client();

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    return {
      ok: false,
      stage: "HEAD_BUCKET",
      bucket,
      s3ErrorCode: awsError?.name || null,
      s3ErrorMessage: awsError?.message || null,
      s3StatusCode: awsError?.$metadata?.httpStatusCode ?? null,
    } as const;
  }

  const fakeKey = `drivers/health-check-${crypto.randomUUID()}.jpg`;
  try {
    await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: fakeKey }), { expiresIn: 300 });
  } catch (error) {
    const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    return {
      ok: false,
      stage: "SIGN_GET_OBJECT",
      bucket,
      s3ErrorCode: awsError?.name || null,
      s3ErrorMessage: awsError?.message || null,
      s3StatusCode: awsError?.$metadata?.httpStatusCode ?? null,
    } as const;
  }

  return {
    ok: true,
    stage: "OK",
    bucket,
    s3ErrorCode: null,
    s3ErrorMessage: null,
    s3StatusCode: null,
  } as const;
}

export async function uploadDriverPhoto(params: {
  fileBuffer: Buffer;
  contentType: string;
  extension: string;
}) {
  const bucket = getDriverPhotosBucket();
  const key = `drivers/${crypto.randomUUID()}.${params.extension}`;
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.fileBuffer,
      ContentType: params.contentType,
    })
  );

  return {
    photoKey: key,
    photoUrl: await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 }),
  };
}
