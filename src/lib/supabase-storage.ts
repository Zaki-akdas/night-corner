/**
 * Server-side Supabase Storage helpers for product images.
 *
 * Uploads into the public bucket (created via SQL/admin — anon keys can't
 * create buckets) so images are directly viewable by URL. The Storage API on
 * this project requires the `apikey` header for the publishable/anon key; the
 * Bearer token is sent alongside for services that accept it. Server-side
 * only — never call this from the client.
 */
const BUCKET = "delivery-proofs";

// Product photos reuse the same public bucket — it's the only bucket on this
// project whose RLS policy allows uploads with the publishable key. Files are
// namespaced under `products/` so product images stay organized.

function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is not set");
  return url.replace(/\/$/, "");
}

/** Publishable (anon-equivalent) key — safe for uploads to the public bucket. */
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

/** Uploads a product image into the public bucket under `products/…`. */
export async function uploadProductPhoto(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const url = supabaseUrl();
  const safePath = `products/${path.replace(/^\/+/, "")}`;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${safePath}`, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "false" }),
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    throw new Error(`Photo upload failed (HTTP ${res.status}): ${await res.text()}`);
  }
  return `${url}/storage/v1/object/public/${BUCKET}/${safePath}`;
}
