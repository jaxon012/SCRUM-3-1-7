# Story Reader Feature — Cursor Implementation Guide

## Overview

This guide wires the `cefr_story_levels_json/` dataset into the existing Read page.
The result: users can scroll through all 60 CEFR stories (plus the existing Treasure Island passage) with Next/Back navigation, levels shown as **Level 1–6**, and the last-read story remembered between sessions. **No existing vocab/word-click functionality is changed.**

---

## What changes and why

| File | Change | Reason |
|---|---|---|
| `shared/schema.ts` | Add `storyOrder` column to `passage` table | Needed to sort stories within a level in the right order |
| `server/storage.ts` | Seed 60 CEFR stories; add 2 progress methods; fix sort order | Loads stories into DB; enables resume-where-left-off |
| `server/routes.ts` | Add 2 reading-progress API endpoints | Server-side persistence of current story position |
| `shared/routes.ts` | Add reading progress API type definitions | Keeps the typed API pattern consistent |
| `client/src/hooks/use-reading.ts` | Add 2 new hooks | Clean data layer for progress |
| `client/src/pages/Read.tsx` | Add navigation, level labels, progress init | The actual reader UI |

---

## Step 1 — Add `storyOrder` to the `passage` table schema

**File: `shared/schema.ts`**

Find the `passage` table definition and add `storyOrder` as a new column:

```ts
// BEFORE:
export const passage = pgTable("passage", {
  passageId: serial("passage_id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  bodyText: text("body_text").notNull(),
  readingLevel: integer("reading_level").notNull(),
  audioUrl: varchar("audio_url", { length: 500 }),
});

// AFTER:
export const passage = pgTable("passage", {
  passageId: serial("passage_id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  bodyText: text("body_text").notNull(),
  readingLevel: integer("reading_level").notNull(),
  audioUrl: varchar("audio_url", { length: 500 }),
  storyOrder: integer("story_order").notNull().default(0),
});
```

---

## Step 2 — Seed stories and add progress methods to storage

**File: `server/storage.ts`**

### 2a — Add new imports at the top

```ts
// Add these imports at the top of the file alongside existing imports:
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { eq, and, sql, count, asc, desc } from "drizzle-orm";
// (replace the existing `import { eq, and, sql, count } from "drizzle-orm";` line)

const __dirname = dirname(fileURLToPath(import.meta.url));
// Add this line right after the imports block, before the PEXELS_API_KEY line
```

### 2b — Add two new methods to the `IStorage` interface

```ts
// Add these two method signatures to the IStorage interface:
getCurrentReadingProgress(userId: number): Promise<number | null>;
upsertReadingProgress(userId: number, passageId: number): Promise<void>;
```

### 2c — Update `getReadingPassages()` to sort in the right order

Replace the existing `getReadingPassages` method body:

```ts
async getReadingPassages(): Promise<Passage[]> {
  const passages = await db
    .select()
    .from(passage)
    .orderBy(asc(passage.readingLevel), asc(passage.storyOrder), asc(passage.passageId));

  return passages.map((p) => ({
    ...p,
    id: p.passageId,
    content: p.bodyText,
    level: p.readingLevel.toString(),
    imageUrl:
      p.audioUrl ||
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
  })) as Passage[];
}
```

### 2d — Add two new methods to `DatabaseStorage` class

Add these two methods anywhere inside the `DatabaseStorage` class (e.g. after `getReadingPassage`):

```ts
async getCurrentReadingProgress(userId: number): Promise<number | null> {
  // Find the most recently visited passage for this user
  const rows = await db
    .select()
    .from(userReadingProgress)
    .where(eq(userReadingProgress.userId, userId))
    .orderBy(desc(userReadingProgress.completedAt))
    .limit(1);
  return rows.length > 0 ? rows[0].passageId : null;
}

async upsertReadingProgress(userId: number, passageId: number): Promise<void> {
  const existing = await db
    .select()
    .from(userReadingProgress)
    .where(
      and(
        eq(userReadingProgress.userId, userId),
        eq(userReadingProgress.passageId, passageId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userReadingProgress)
      .set({ completedAt: new Date(), percentComplete: 50 })
      .where(eq(userReadingProgress.userReadingId, existing[0].userReadingId));
  } else {
    await db.insert(userReadingProgress).values({
      userId,
      passageId,
      percentComplete: 50,
      completedAt: new Date(),
    });
  }
}
```

### 2e — Add a private `seedCefrStories()` method

Add this private method inside the `DatabaseStorage` class:

```ts
private async seedCefrStories(): Promise<void> {
  const levelMap: Record<string, number> = {
    A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
  };
  const files = ["A1", "A2", "B1", "B2", "C1", "C2"];

  for (const levelKey of files) {
    const filePath = join(__dirname, "..", "cefr_story_levels_json", `${levelKey}.json`);
    const data = JSON.parse(readFileSync(filePath, "utf-8")) as {
      stories: { id: string; order: number; title: string; text: string }[];
    };
    const readingLevel = levelMap[levelKey];

    for (const story of data.stories) {
      await db.insert(passage).values({
        title: story.title,
        bodyText: story.text,
        readingLevel,
        storyOrder: story.order,
        audioUrl: null,
      });
    }
  }
  console.log("[seed] Seeded 60 CEFR stories.");
}
```

### 2f — Call `seedCefrStories()` inside `seedData()`

Inside the existing `seedData()` method, add a CEFR stories check. Put this block **after** the `shouldSeedPassages` block that inserts the Treasure Island passage:

```ts
// Add this block right after the `if (shouldSeedPassages) { ... }` block:
const [cefrCheck] = await db
  .select({ cnt: count() })
  .from(passage)
  .where(sql`story_order > 0`);
if (Number(cefrCheck.cnt) === 0) {
  await this.seedCefrStories();
}
```

### 2g — Update the Treasure Island seed SQL to include `story_order`

Find the existing `INSERT INTO passage` SQL inside `if (shouldSeedPassages)` and update it:

```ts
// BEFORE:
await db.execute(sql`
  INSERT INTO passage (title, body_text, reading_level, audio_url)
  VALUES
    ('Treasure Island Excerpt', '...', 2, '...')
`);

// AFTER (add story_order = 0 — the exact text value stays the same):
await db.execute(sql`
  INSERT INTO passage (title, body_text, reading_level, audio_url, story_order)
  VALUES
    ('Treasure Island Excerpt', 'Well, then, said he, this is the berth for me. Here you, matey, he cried to the man who trundled the barrow; bring up alongside and help up my chest. I''ll stay here a bit, he continued.', 2, 'https://example.com/treasure_island.mp3', 0)
`);
```

---

## Step 3 — Add reading progress API routes

**File: `server/routes.ts`**

Add these two routes inside `registerRoutes()`, anywhere after the existing passage routes (e.g. after the `app.get(api.readingPassages.get.path, ...)` block):

```ts
// GET current reading position for this user
app.get("/api/reading-progress/current", async (req, res) => {
  const userId = req.session.userId || 1;
  const passageId = await storage.getCurrentReadingProgress(userId);
  res.json({ passageId });
});

// Save current reading position
app.post("/api/reading-progress", async (req, res) => {
  const userId = req.session.userId || 1;
  const { passageId } = req.body || {};
  if (!passageId || isNaN(Number(passageId))) {
    return res.status(400).json({ message: "passageId required" });
  }
  await storage.upsertReadingProgress(userId, Number(passageId));
  res.json({ ok: true });
});
```

---

## Step 4 — Add reading progress hooks

**File: `client/src/hooks/use-reading.ts`**

Replace the entire file content with the following (the two existing hooks are unchanged; two new ones are added at the bottom):

```ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useReadingPassages() {
  return useQuery({
    queryKey: [api.readingPassages.list.path],
    queryFn: async () => {
      const res = await fetch(api.readingPassages.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reading passages");
      return api.readingPassages.list.responses[200].parse(await res.json());
    },
  });
}

export function useReadingPassage(id: number) {
  return useQuery({
    queryKey: [api.readingPassages.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.readingPassages.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch passage");
      return api.readingPassages.get.responses[200].parse(await res.json());
    },
  });
}

export function useCurrentReadingProgress() {
  return useQuery({
    queryKey: ["/api/reading-progress/current"],
    queryFn: async () => {
      const res = await fetch("/api/reading-progress/current", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.passageId as number) ?? null;
    },
  });
}

export function useSaveReadingProgress() {
  return useMutation({
    mutationFn: async (passageId: number) => {
      await fetch("/api/reading-progress", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passageId }),
      });
    },
  });
}
```

---

## Step 5 — Rewrite `Read.tsx` with navigation and level display

**File: `client/src/pages/Read.tsx`**

Replace the entire file with the following. The word-click popup and all vocab functionality is **identical** to the original — only the navigation, level display, and progress wiring are new:

```tsx
import { Layout } from "@/components/Layout";
import { useReadingPassages, useCurrentReadingProgress, useSaveReadingProgress } from "@/hooks/use-reading";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useWords } from "@/hooks/use-words";
import { useVocabLists, useCreateVocabList, useAddWordToVocabList } from "@/hooks/use-vocab-lists";
import { CreateVocabListDialog } from "@/components/CreateVocabListDialog";
import type { Passage } from "@shared/schema";

// Level display helpers — maps the integer readingLevel (1–6) to human-readable labels
const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1",
  2: "Level 2",
  3: "Level 3",
  4: "Level 4",
  5: "Level 5",
  6: "Level 6",
};

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Upper Intermediate",
  5: "Advanced",
  6: "Proficient",
};

// Interactive word component — UNCHANGED from original
function ClickableWord({ word, onClick }: { word: string; onClick: (w: string) => void }) {
  const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
  return (
    <span
      onClick={() => onClick(cleanWord)}
      className="cursor-pointer hover:bg-primary/20 hover:text-primary rounded px-0.5 transition-colors duration-200"
    >
      {word}{" "}
    </span>
  );
}

export default function Read() {
  const { data: passages, isLoading } = useReadingPassages();
  const { data: savedPassageId } = useCurrentReadingProgress();
  const saveProgress = useSaveReadingProgress();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [progressInitialized, setProgressInitialized] = useState(false);

  // Existing vocab state — UNCHANGED
  const { data: vocabWords } = useWords();
  const { data: lists } = useVocabLists();
  const createList = useCreateVocabList();
  const addWordToList = useAddWordToVocabList();
  const [selectedListId, setSelectedListId] = useState<number | "">("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Initialize current story index from server-side saved progress
  useEffect(() => {
    if (!progressInitialized && passages && passages.length > 0 && savedPassageId !== undefined) {
      if (savedPassageId !== null) {
        const idx = passages.findIndex((p) => (p as any).passageId === savedPassageId);
        if (idx >= 0) setCurrentIndex(idx);
      }
      setProgressInitialized(true);
    }
  }, [passages, savedPassageId, progressInitialized]);

  // Save progress whenever currentIndex changes (after initialization)
  useEffect(() => {
    if (!progressInitialized || !passages || passages.length === 0) return;
    const current = passages[currentIndex] as any;
    if (current?.passageId) {
      saveProgress.mutate(current.passageId);
    }
  }, [currentIndex, progressInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalStories = passages?.length ?? 0;

  const handleNext = () => {
    if (!passages || currentIndex >= passages.length - 1) return;
    setCurrentIndex((i) => i + 1);
    setSelectedWord(null);
  };

  const handleBack = () => {
    if (currentIndex <= 0) return;
    setCurrentIndex((i) => i - 1);
    setSelectedWord(null);
  };

  // Current passage — falls back to a default while loading
  const passage = (passages?.[currentIndex] as Passage | undefined) || {
    passageId: 0,
    title: "The Morning Routine",
    bodyText:
      "Every morning, Sarah wakes up at 7:00 AM. She brushes her teeth and washes her face. Then, she goes to the kitchen to make breakfast. She usually eats toast with jam and drinks a cup of coffee. After breakfast, she gets dressed and walks to the bus stop to go to work.",
    readingLevel: 1,
    audioUrl: null,
    id: 0,
    content:
      "Every morning, Sarah wakes up at 7:00 AM. She brushes her teeth and washes her face.",
    level: "1",
    imageUrl: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&q=80",
  } as Passage;

  const content = (passage as any).content || passage.bodyText || "";
  const words = content.split(" ");
  const imageUrl = (
    (passage as any).imageUrl ||
    passage.audioUrl ||
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"
  ) as string;

  // Level display — show "Level X" with description instead of raw CEFR code
  const levelNum = passage?.readingLevel ?? 1;
  const levelLabel = LEVEL_LABELS[levelNum] ?? `Level ${levelNum}`;
  const levelDesc = LEVEL_DESCRIPTIONS[levelNum] ?? "";

  // Compute read time from actual word count
  const wordCount = words.filter(Boolean).length;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 130));
  const readTimeLabel = `${readMinutes} min read`;

  // Vocab word matching — UNCHANGED
  const matchingWord = useMemo(() => {
    if (!selectedWord || !vocabWords) return null;
    const clean = selectedWord.toLowerCase();
    return (vocabWords as any[]).find((w) => w.term.toLowerCase() === clean) || null;
  }, [selectedWord, vocabWords]);

  return (
    <Layout title="Reading Practice">
      <div className="space-y-6">
        {/* Header Image */}
        <div className="relative h-48 rounded-3xl overflow-hidden shadow-lg">
          <img
            src={imageUrl}
            alt="Reading context"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
            <span className="text-xs font-bold text-primary-foreground bg-primary/90 px-2 py-1 rounded-md w-fit mb-2 backdrop-blur-sm">
              {levelLabel} · {levelDesc}
            </span>
            <h2 className="text-2xl font-bold text-white">{passage.title}</h2>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{readTimeLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Book className="w-4 h-4" />
              <span>{wordCount} words</span>
            </div>
          </div>
          {/* Story counter */}
          {totalStories > 0 && (
            <span className="text-xs font-medium">
              {currentIndex + 1} / {totalStories}
            </span>
          )}
        </div>

        {/* Text Content */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 leading-loose text-lg text-foreground/90 font-serif">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-secondary rounded w-full" />
              <div className="h-4 bg-secondary rounded w-5/6" />
              <div className="h-4 bg-secondary rounded w-full" />
              <div className="h-4 bg-secondary rounded w-4/6" />
            </div>
          ) : (
            <p>
              {words.map((word: string, i: number) => (
                <ClickableWord key={i} word={word} onClick={setSelectedWord} />
              ))}
            </p>
          )}
        </div>

        {/* Navigation — Back / Next */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex <= 0}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-secondary text-secondary-foreground font-semibold text-sm disabled:opacity-40 hover:bg-secondary/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!passages || currentIndex >= passages.length - 1}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Word Definition Popup — UNCHANGED from original */}
      <AnimatePresence>
        {selectedWord && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWord(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none px-4 pb-24"
            >
              <div className="bg-card w-full max-w-lg md:max-w-xl rounded-3xl shadow-2xl border border-border/50 p-6 pointer-events-auto relative max-h-[80vh] overflow-y-auto">
                <button
                  onClick={() => setSelectedWord(null)}
                  className="absolute top-4 right-4 p-1 hover:bg-secondary rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>

                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold font-display capitalize mb-1">{selectedWord}</h3>
                    <p className="text-sm text-muted-foreground italic">
                      {matchingWord?.phonetic ? `noun • ${matchingWord.phonetic}` : "noun"}
                    </p>
                  </div>
                  <AudioPlayer text={selectedWord} className="bg-primary/10 text-primary w-12 h-12" />
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Definition</h4>
                    <p className="text-foreground/90">
                      {matchingWord?.definition ?? "Pick a word and practice it to see its meaning."}
                    </p>
                  </div>
                  <div className="bg-secondary/50 p-3 rounded-xl">
                    <p className="text-sm italic text-muted-foreground">
                      "Try using{" "}
                      <span className="text-primary font-medium">{selectedWord}</span> in a sentence
                      you'd say today."
                    </p>
                  </div>
                </div>

                {/* Add to Vocab — UNCHANGED */}
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Add to Vocab
                  </p>
                  <div className="space-y-2">
                    <select
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Choose a list…</option>
                      {lists?.map((list) => (
                        <option key={list.vocabListId} value={list.vocabListId}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedWord || !selectedListId) return;
                        try {
                          if (matchingWord) {
                            await addWordToList.mutateAsync({
                              listId: Number(selectedListId),
                              wordId: matchingWord.wordId,
                            });
                          } else {
                            await addWordToList.mutateAsync({
                              listId: Number(selectedListId),
                              term: selectedWord,
                            });
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      disabled={!selectedListId || addWordToList.isPending}
                      className="w-full px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                    >
                      {addWordToList.isPending ? "Adding..." : "Add to Vocab"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="w-full text-xs font-semibold text-primary mt-2 hover:text-primary/80"
                  >
                    + Create New List
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CreateVocabListDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={async (name) => {
          const created = await createList.mutateAsync(name);
          setSelectedListId(created.vocabListId);
          if (matchingWord) {
            await addWordToList.mutateAsync({
              listId: created.vocabListId,
              wordId: matchingWord.wordId,
            });
          }
        }}
      />
    </Layout>
  );
}
```

---

## Step 6 — Push the schema change to the database

After making all the code changes above, run this once from the project root:

```bash
npm run db:push
```

This adds the `story_order` column to the existing `passage` table. It is safe to run on an existing DB — Drizzle will only add the missing column.

Then restart the dev server (`npm run dev`). On first start, the server will automatically seed all 60 CEFR stories into the `passage` table.

---

## How the vocab API is affected

**It is not affected at all.** The vocab system operates entirely on the `word`, `vocabListWord`, and `vocabList` tables. The story content in `passage` has no relationship to those tables — clicking a word in the reader triggers the same `addWordToVocabList` / `createOrGetWordFromTerm` flow as before. No routes, schemas, or hooks in the vocab system are touched.

---

## Level mapping reference

| DB `readingLevel` | Displayed as | CEFR equivalent |
|---|---|---|
| 1 | Level 1 · Beginner | A1 |
| 2 | Level 2 · Elementary | A2 |
| 3 | Level 3 · Intermediate | B1 |
| 4 | Level 4 · Upper Intermediate | B2 |
| 5 | Level 5 · Advanced | C1 |
| 6 | Level 6 · Proficient | C2 |

The existing "Treasure Island Excerpt" seed passage has `readingLevel = 2`, so it will appear in the reader as **Level 2 · Elementary** alongside the A2 stories.
