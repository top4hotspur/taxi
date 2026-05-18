import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

export function buildDriverPhotoPublicUrl(bucket: string, key: string) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
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
    photoUrl: buildDriverPhotoPublicUrl(bucket, key),
  };
}
