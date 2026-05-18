import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth/guards";
import { uploadDriverPhoto } from "@/lib/storage/driverPhotos";

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

  try {
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, errorCode: "PHOTO_REQUIRED", message: "Please choose a photo to upload." }, { status: 400 });
    }

    const mime = file.type;
    if (!ALLOWED[mime]) {
      return NextResponse.json({ ok: false, errorCode: "PHOTO_TYPE_NOT_ALLOWED", message: "Only JPG, PNG or WebP images are allowed." }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ ok: false, errorCode: "PHOTO_TOO_LARGE", message: "Photo must be 5MB or smaller." }, { status: 400 });
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
    const msg = error instanceof Error ? error.message : "Upload failed";
    if (msg === "DRIVER_PHOTOS_BUCKET_NOT_CONFIGURED") {
      return NextResponse.json(
        { ok: false, errorCode: "DRIVER_PHOTOS_BUCKET_NOT_CONFIGURED", message: "Driver photo upload is not configured." },
        { status: 503 }
      );
    }
    console.error(
      JSON.stringify({
        level: "error",
        source: "api.admin.drivers.photo",
        message: msg,
      })
    );
    return NextResponse.json(
      { ok: false, errorCode: "DRIVER_PHOTO_UPLOAD_FAILED", message: "Driver photo upload failed. Please try again." },
      { status: 500 }
    );
  }
}
