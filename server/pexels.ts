const PEXELS_SEARCH = "https://api.pexels.com/v1/search";

export function resolvePexelsApiKey(): string | undefined {
  const raw = process.env.PEXELS_API_KEY;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().replace(/^\uFEFF/, "");
  return t.length > 0 ? t : undefined;
}

/**
 * Map Adventure scene prompt (long) to a short Pexels search query.
 */
export function adventurePromptToPexelsQuery(prompt: string): string {
  const marker = "Show this moment:";
  const idx = prompt.indexOf(marker);
  let q = idx >= 0 ? prompt.slice(idx + marker.length).trim() : prompt;
  q = q.replace(/\s+/g, " ").trim();
  q = q.replace(/^fantasy adventure scene[^.]*\.\s*/i, "").trim();
  if (q.length < 2) q = "fantasy castle adventure landscape";
  return q.slice(0, 200);
}

export async function fetchPexelsPhotoUrl(
  query: string,
  options: { orientation?: "landscape" | "portrait" | "square" } = {}
): Promise<string | null> {
  const apiKey = resolvePexelsApiKey();
  if (!apiKey) {
    console.warn("PEXELS_API_KEY is not set; skipping image lookup.");
    return null;
  }

  const q = query.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!q) return null;

  try {
    const url = new URL(PEXELS_SEARCH);
    url.searchParams.set("query", q);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", options.orientation ?? "landscape");

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      console.error("Pexels API error status:", res.status);
      return null;
    }

    const data = (await res.json()) as {
      photos?: Array<{
        src?: { large?: string; medium?: string; large2x?: string; original?: string };
      }>;
    };
    const photo = data?.photos?.[0];
    const src = photo?.src;
    return (
      src?.large || src?.large2x || src?.medium || src?.original || null
    );
  } catch (error) {
    console.error("Error calling Pexels API:", error);
    return null;
  }
}
