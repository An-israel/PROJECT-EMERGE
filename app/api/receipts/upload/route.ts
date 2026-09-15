import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { validateFile } from "@/lib/validation";
import {
  RECEIPT_BUCKET,
  inferMimeType,
  receiptObjectPath,
} from "@/lib/upload";

export const runtime = "nodejs";

/**
 * Same-origin receipt upload.
 *
 * Partners on some mobile networks cannot reach `*.supabase.co` from the
 * browser at all — the request dies as "Failed to fetch" before Storage ever
 * sees it — while requests to this app's own domain work fine. So the file is
 * relayed through here and written with the service role: no cross-origin
 * request, no CORS, and no dependence on storage RLS.
 *
 * A Route Handler is used rather than a Server Action because Server Actions
 * cap the request body at 1MB. This route is still bound by the platform's
 * own request limit (4.5MB on Vercel), which is why the client shrinks photos
 * first and falls back to a direct signed-URL upload for anything larger.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }

  const limit = rateLimit(`receipt-route:${profile.id}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    console.error("[receipt:route-form]", err);
    return NextResponse.json(
      {
        error: "We could not read the upload. The file may be too large.",
        detail: err instanceof Error ? err.message : undefined,
      },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Please attach your receipt file." },
      { status: 400 },
    );
  }

  const fileError = validateFile({
    type: file.type,
    size: file.size,
    name: file.name,
  });
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  const path = receiptObjectPath(profile.id, file.name, file.type);
  const { error } = await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .upload(path, file, {
      contentType: inferMimeType(file.name, file.type) || undefined,
      upsert: false,
    });

  if (error) {
    console.error("[receipt:route-upload]", error);
    return NextResponse.json(
      { error: "Storage would not accept the file.", detail: error.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ path });
}
