/**
 * Server-side Supabase Storage helpers for proof-of-delivery photos.
 *
 * Uploads into the public `delivery-proofs` bucket (created via SQL/admin —
 * anon keys can't create buckets) so photos are directly viewable by URL.
 * The Storage API on this project requires the `apikey` header for the
 * publishable/anon key; the Bearer token is sent alongside for services that
 * accept it. Server-side only — never call this from the client.
 */
const BUCKET = "delivery-proofs";

// Product photos reuse the same public bucket — it's the only bucket on this
// project whose RLS policy allows uploads with the publishable key. Files are
// namespaced under `products/` so delivery proofs and product images never
// collide.

function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is not set");
  return url.replace(/\/$/, "");
}

/** Publishable (anon-equivalent) key — safe for uploads to the delivery-proofs bucket. */
function anonKey(): string {
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY is not set");
  return key;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = anonKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

/**
 * Uploads a delivery photo and returns its public URL. `path` should be unique
 * per upload (e.g. `${orderId}/${Date.now()}-${filename}`).
 */
export async function uploadDeliveryPhoto(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  return uploadPublicPhoto(BUCKET, path, buffer, contentType);
}

/** Uploads a product image into the public bucket under `products/…`. */
export async function uploadProductPhoto(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  return uploadPublicPhoto(BUCKET, `products/${path.replace(/^\/+/, "")}`, buffer, contentType);
}

async function uploadPublicPhoto(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const url = supabaseUrl();
  const safePath = path.replace(/^\/+/, "");
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${safePath}`, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "false" }),
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    throw new Error(`Photo upload failed (HTTP ${res.status}): ${await res.text()}`);
  }
  return `${url}/storage/v1/object/public/${bucket}/${safePath}`;
}

/** Best-effort removal (used by tests / admin cleanup). */
export async function deleteDeliveryPhoto(url: string): Promise<void> {
  try {
    const prefix = `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/`;
    if (!url.startsWith(prefix)) return;
    const path = url.slice(prefix.length);
    await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
      method: "DELETE",
      headers: headers(),
    });
  } catch {
    // Non-critical cleanup.
  }
}
