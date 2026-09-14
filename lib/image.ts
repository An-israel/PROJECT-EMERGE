/**
 * Client-side image shrinking for receipt photos.
 *
 * A phone camera photo of a bank receipt is 2–6MB, which is slow on a Nigerian
 * mobile connection and too large to relay through our own server. Downscaling
 * to a readable 1600px JPEG puts almost every receipt under a megabyte with no
 * loss of legibility, which makes the upload fast and keeps it same-origin.
 *
 * Pure geometry lives here so it can be unit tested; the canvas work is
 * best-effort and always falls back to the original file.
 */

/** Longest edge we keep. A receipt stays easily readable at this size. */
export const MAX_IMAGE_EDGE = 1600;

/** Only bother shrinking when there is something to gain. */
export const COMPRESS_ABOVE_BYTES = 600 * 1024;

export function scaledDimensions(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** JPEG/PNG/WEBP shrink well; a PDF must be sent as it is. */
export function isShrinkableImage(type: string, name: string): boolean {
  const candidate = (type || "").toLowerCase();
  if (candidate.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp)$/i.test(name ?? "");
}

export function shouldCompress(file: {
  type: string;
  name: string;
  size: number;
}): boolean {
  return (
    isShrinkableImage(file.type, file.name) && file.size > COMPRESS_ABOVE_BYTES
  );
}

/**
 * Shrink an image file in the browser. Returns the original file unchanged if
 * anything at all goes wrong, or if the result would not actually be smaller —
 * this must never be the reason a receipt fails to upload.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!shouldCompress(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
