"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type UploadResult = { photoKey: string; photoUrl: string };

type UploadDiagnostics = {
  bucketConfigured?: boolean;
  bucketNamePresent?: boolean;
  bucketName?: string | null;
  region?: string;
  fileReceived?: boolean;
  fileMimeType?: string;
  fileSizeBytes?: number;
  s3ErrorName?: string | null;
  s3ErrorCode?: string | null;
  s3StatusCode?: number | null;
};

type UploadErrorResponse = {
  ok?: boolean;
  errorCode?: string;
  message?: string;
  photoKey?: string;
  photoUrl?: string;
  diagnostics?: UploadDiagnostics;
};

type Props = {
  value: UploadResult | null;
  onChange: (next: UploadResult | null) => void;
};

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export default function DriverPhotoUploader({ value, onChange }: Props) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadDiagnostics, setUploadDiagnostics] = useState<UploadDiagnostics | null>(null);
  const [uploadErrorCode, setUploadErrorCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previewUrl = value?.photoUrl || "";

  const helper = useMemo(() => "Upload a clear driver photo. JPG, PNG or WebP, max 5MB.", []);

  async function handleFile(file?: File | null) {
    setError("");
    setUploadDiagnostics(null);
    setUploadErrorCode(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPG, PNG or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Photo is too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/admin/drivers/photo", { method: "POST", body: formData });
      const data = (await res.json()) as UploadErrorResponse;
      if (!res.ok || !data.ok || !data.photoKey || !data.photoUrl) {
        setError(data.message || "Driver photo upload failed. Please try again.");
        setUploadDiagnostics(data.diagnostics || null);
        setUploadErrorCode(data.errorCode || null);
        return;
      }
      onChange({ photoKey: data.photoKey, photoUrl: data.photoUrl });
    } catch {
      setError("Driver photo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border p-4 text-sm ${dragOver ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white"}`}
      >
        <p className="font-medium text-slate-800">Driver photo</p>
        <p className="mt-1 text-xs text-slate-600">{helper}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {uploading ? "Uploading..." : "Choose photo"}
          </button>
          {value ? (
            <button type="button" onClick={() => onChange(null)} className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700">
              Remove
            </button>
          ) : null}
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onInputChange} />
      </div>

      {previewUrl ? (
        <div className="h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Driver preview" className="h-full w-full object-cover" />
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          <p className="text-xs">
            <Link href="/api/admin/health/driver-photo-storage-test" target="_blank" className="underline underline-offset-2">
              Check driver photo storage health
            </Link>
          </p>
          {(uploadErrorCode || uploadDiagnostics) ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-red-700">Show debug details</summary>
              <div className="mt-2 space-y-1">
                <p>Error code: {uploadErrorCode || "N/A"}</p>
                <p>Region: {uploadDiagnostics?.region || "N/A"}</p>
                <p>Bucket configured: {uploadDiagnostics?.bucketConfigured ? "Yes" : "No"}</p>
                <p>S3 error code: {uploadDiagnostics?.s3ErrorCode || uploadDiagnostics?.s3ErrorName || "N/A"}</p>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
