export function generateDriverDocumentReference(params: {
  userId: string;
  type: string;
  originalFileName: string;
}) {
  const cleanName = params.originalFileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const timestamp = Date.now();

  // S3/Amplify Storage-ready key format.
  return `drivers/${params.userId}/documents/${params.type}/${timestamp}-${cleanName}`;
}
