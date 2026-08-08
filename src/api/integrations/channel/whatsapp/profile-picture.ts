export type ProfilePictureUrlFetcher = (jid: string, type: 'preview' | 'image', timeoutMs: number) => Promise<string>;
export type CachedProfilePictureUrlFetcher = (jid: string) => Promise<string | null>;

/**
 * Resolve the small WhatsApp avatar first. The preview is what chat lists need
 * and is available more often than the full-size image. A fast preview failure
 * may fall back to the full image, but both attempts share one timeout budget
 * so inbound message processing can never be delayed twice.
 */
export async function resolveProfilePictureUrl(
  fetchUrl: ProfilePictureUrlFetcher,
  jid: string,
  timeoutMs = 5_000,
  now: () => number = Date.now,
  fetchCachedUrl?: CachedProfilePictureUrlFetcher,
): Promise<string | null> {
  const startedAt = now();

  try {
    const previewUrl = await fetchUrl(jid, 'preview', timeoutMs);
    if (previewUrl) return previewUrl;
  } catch {
    // A missing/private preview is expected; use any remaining budget below.
  }

  const remainingMs = timeoutMs - (now() - startedAt);
  if (remainingMs > 0) {
    try {
      const imageUrl = await fetchUrl(jid, 'image', remainingMs);
      if (imageUrl) return imageUrl;
    } catch {
      // The live WhatsApp query can fail for privacy or timeout reasons.
    }
  }

  if (!fetchCachedUrl) return null;

  try {
    return (await fetchCachedUrl(jid)) || null;
  } catch {
    return null;
  }
}
