# Word Definitions Fix — Cursor Implementation Guide

## Problem
When a reader clicks a word in a story, the popup shows "Pick a word and practice it to see its meaning."
because the word isn't in the `word` table. Only the original 6 seed words have definitions.

## Solution
1. Modify `createOrGetWordFromTerm` in `server/storage.ts` to fetch a real definition from the **Free Dictionary API** (free, no API key needed) whenever a new word is created.
2. Add a `GET /api/word-lookup/:term` endpoint that creates-or-fetches the word and returns it.
3. Add a `useWordLookup(term)` hook on the client.
4. Update `Read.tsx` to use the hook — show the real definition, with a loading state while it fetches.

Words are **cached in the `word` table** after the first lookup, so repeat clicks are instant and the word is already available for the "Add to Vocab" flow.

---

## Step 1 — Update `createOrGetWordFromTerm` to fetch real definitions

**File: `server/storage.ts`**

Replace the entire `createOrGetWordFromTerm` method with the version below.
The only meaningful change is the block that builds `definition`, `phonetic`, and `audioUrl`
— instead of hard-coding the placeholder string, it calls the Free Dictionary API.

```ts
async createOrGetWordFromTerm(term: string): Promise<Word> {
  const cleanTerm = term.trim();
  const lowered = cleanTerm.toLowerCase();

  // Return from cache if already in DB
  const existing = await db
    .select()
    .from(word)
    .where(eq(word.term, lowered));
  if (existing.length > 0) {
    return existing[0];
  }

  // --- Fetch definition from Free Dictionary API (no API key required) ---
  let definition = "Definition not available.";
  let phonetic: string | null = null;
  let wordAudioUrl: string | null = null;

  try {
    const dictRes = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowered)}`
    );
    if (dictRes.ok) {
      const dictData: any[] = await dictRes.json();
      const entry = dictData[0];
      // First available definition
      definition =
        entry?.meanings?.[0]?.definitions?.[0]?.definition ??
        "Definition not available.";
      // First phonetic text (e.g. /həˈloʊ/)
      phonetic =
        entry?.phonetics?.find((p: any) => p.text)?.text ?? null;
      // First audio URL (the API provides MP3 links)
      wordAudioUrl =
        entry?.phonetics?.find((p: any) => p.audio && p.audio !== "")?.audio ??
        null;
    }
  } catch (err) {
    console.error(`[dict] Failed to fetch definition for "${lowered}":`, err);
  }

  // --- Fetch an image from Pexels (existing behaviour, unchanged) ---
  let imageUrl: string | null = null;
  try {
    const pexelsResult = await fetchPexelsImageUrl(cleanTerm);
    imageUrl = pexelsResult;
  } catch (e) {
    console.error("Error fetching Pexels image for user-added word:", e);
  }

  const [created] = await db
    .insert(word)
    .values({
      term: lowered,
      definition,
      phonetic,
      audioUrl: wordAudioUrl,
      imageUrl: imageUrl ?? null,
    })
    .returning();

  return created;
}
```

---

## Step 2 — Add a `GET /api/word-lookup/:term` endpoint

**File: `server/routes.ts`**

Add this route anywhere inside `registerRoutes()`, for example right after the existing
`app.post(api.addToVocab.path, ...)` block:

```ts
// Word lookup — fetches definition from Free Dictionary API and caches in DB
app.get("/api/word-lookup/:term", async (req, res) => {
  const term = (req.params.term || "").trim();
  if (!term) {
    return res.status(400).json({ message: "term is required" });
  }
  try {
    const result = await storage.createOrGetWordFromTerm(term);
    res.json(result);
  } catch (error) {
    console.error("word-lookup error:", error);
    res.status(500).json({ message: "Failed to look up word" });
  }
});
```

---

## Step 3 — Add a `useWordLookup` hook

**File: `client/src/hooks/use-words.ts`**

Open the file and add this new exported hook at the bottom.
Do **not** change any of the existing hooks in the file.

```ts
import { useQuery } from "@tanstack/react-query";

// Add at the bottom of the file:

export function useWordLookup(term: string | null) {
  return useQuery({
    queryKey: ["/api/word-lookup", term?.toLowerCase()],
    queryFn: async () => {
      if (!term) return null;
      const res = await fetch(
        `/api/word-lookup/${encodeURIComponent(term.toLowerCase())}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      return res.json() as Promise<{
        wordId: number;
        term: string;
        definition: string;
        phonetic: string | null;
        audioUrl: string | null;
        imageUrl: string | null;
      }>;
    },
    enabled: !!term && term.trim().length > 0,
    staleTime: 1000 * 60 * 60, // cache for 1 hour — word definitions don't change
  });
}
```

> **Note:** If `use-words.ts` doesn't already import `useQuery` from `@tanstack/react-query`, add that import at the top.

---

## Step 4 — Update `Read.tsx` to use the lookup hook

**File: `client/src/pages/Read.tsx`**

### 4a — Add the import

Add `useWordLookup` to the import from `@/hooks/use-words`:

```ts
// Find the line that imports from "@/hooks/use-words" and add useWordLookup:
import { useWords } from "@/hooks/use-words";
// becomes:
import { useWords, useWordLookup } from "@/hooks/use-words";
```

### 4b — Add the lookup query

Inside the `Read` component, add this line right after the `useWords()` call:

```ts
const { data: vocabWords } = useWords();
// ADD this line directly below:
const { data: lookedUpWord, isLoading: isLookingUp } = useWordLookup(selectedWord);
```

### 4c — Replace the `matchingWord` memo

Find the `matchingWord` `useMemo` block and replace it entirely:

```ts
// REMOVE this block:
const matchingWord = useMemo(() => {
  if (!selectedWord || !vocabWords) return null;
  const clean = selectedWord.toLowerCase();
  return (vocabWords as any[]).find((w) => w.term.toLowerCase() === clean) || null;
}, [selectedWord, vocabWords]);

// REPLACE with:
// Prefer the fresh lookup result; fall back to the vocabWords cache
const matchingWord = useMemo(() => {
  if (lookedUpWord) return lookedUpWord;
  if (!selectedWord || !vocabWords) return null;
  const clean = selectedWord.toLowerCase();
  return (vocabWords as any[]).find((w) => w.term.toLowerCase() === clean) || null;
}, [lookedUpWord, selectedWord, vocabWords]);
```

### 4d — Add a loading state to the definition section in the popup

Inside the word popup JSX, find the "Definition" section and add a loading indicator:

```tsx
{/* BEFORE: */}
<div>
  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Definition</h4>
  <p className="text-foreground/90">
    {matchingWord?.definition ?? "Pick a word and practice it to see its meaning."}
  </p>
</div>

{/* AFTER: */}
<div>
  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Definition</h4>
  {isLookingUp ? (
    <div className="space-y-2 animate-pulse">
      <div className="h-4 bg-secondary rounded w-full" />
      <div className="h-4 bg-secondary rounded w-3/4" />
    </div>
  ) : (
    <p className="text-foreground/90">
      {matchingWord?.definition ?? "No definition found for this word."}
    </p>
  )}
  {matchingWord?.phonetic && !isLookingUp && (
    <p className="text-xs text-muted-foreground mt-1">{matchingWord.phonetic}</p>
  )}
</div>
```

---

## How it works end-to-end

1. User clicks any word in a story.
2. `useWordLookup(selectedWord)` fires a query to `GET /api/word-lookup/:term`.
3. Server checks the `word` table — if the word exists, returns it immediately.
4. If not, server calls `https://api.dictionaryapi.dev/api/v2/entries/en/:term`, parses the first definition + phonetic + audio URL, inserts it into the `word` table, and returns it.
5. The popup shows the real definition (with a brief skeleton while loading).
6. From that point on the word is in the DB — "Add to Vocab" works normally, and the next click returns it from cache.

## What is NOT changed
- The vocab add flow (`addWordToVocabList`, `createOrGetWordFromTerm` called from vocab routes) works exactly as before — it now just gets a real definition instead of a placeholder.
- No schema changes needed.
- No `db:push` step needed.
- All navigation, progress, and level display from the previous guide are unaffected.

## Free Dictionary API notes
- Endpoint: `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
- No API key, no rate limit for reasonable usage.
- Returns 404 for words it doesn't know (slang, proper nouns, abbreviations) — the server handles this gracefully and stores "Definition not available." so the popup still opens cleanly.
