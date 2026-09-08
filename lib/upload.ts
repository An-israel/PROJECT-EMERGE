/**
 * File-upload helpers shared by the browser and the server.
 *
 * Receipts are uploaded straight from the browser to Supabase Storage, so a
 * phone photo never travels through a Server Action — those cap the whole
 * request at 1MB by default (and 4.5MB on Vercel regardless), which is far
 * below the size of an ordinary camera photo. The browser uploads the file
 * and hands the server only the resulting object path; these functions build
 * that path and let the server prove it belongs to the caller.
 */

/** Extensions we can map back to a type when a browser reports none. */
const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function fileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  if (parts.length < 2) return "";
  return parts.pop()!.replace(/[^a-z0-9]/g, "").slice(0, 8);
}

/**
 * Some Android browsers and file managers hand over a file with an empty
 * `type`. Fall back to the extension rather than rejecting a valid receipt.
 */
export function inferMimeType(fileName: string, reportedType: string): string {
  const reported = reportedType?.trim();
  if (reported) return reported;
  return EXTENSION_MIME[fileExtension(fileName)] ?? "";
}

/**
 * Where a partner's receipt lives: `{userId}/{timestamp}-receipt.{ext}`.
 * The first segment must be the user's own id — that is exactly what the
 * storage RLS policy checks, so the path is the permission.
 */
export function receiptObjectPath(
  userId: string,
  fileName: string,
  mimeType: string,
  now: number = Date.now(),
): string {
  const fromName = fileExtension(fileName);
  const type = inferMimeType(fileName, mimeType);
  const fromType = Object.entries(EXTENSION_MIME).find(
    ([, mime]) => mime === type,
  )?.[0];
  const ext = fromName || fromType || "dat";
  return `${userId}/${now}-receipt.${ext}`;
}

/** True when `path` is inside this user's own folder, with no traversal. */
export function isOwnObjectPath(path: string, userId: string): boolean {
  if (!path || !userId) return false;
  if (path.includes("..") || path.startsWith("/")) return false;
  const segments = path.split("/");
  if (segments.length !== 2) return false;
  const [folder, name] = segments;
  return folder === userId && name.length > 0;
}

/** The object name within the user's folder, or null if the path is not theirs. */
export function objectNameFor(path: string, userId: string): string | null {
  if (!isOwnObjectPath(path, userId)) return null;
  return path.slice(userId.length + 1);
}
