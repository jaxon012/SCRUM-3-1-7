# Level Navigation — Cursor Implementation Guide

## What we're building
1. A **level dropdown** on the level badge — click it to see all 6 levels and jump to any one.
2. When jumping to a level, land on the **last-read story in that level** (falls back to story 1 if never visited).
3. The progress counter shows **X / 10** (stories within the current level only, not all 62).
4. A **"Feeling ready for the next level?"** banner on the last story of each level, with a primary "Go to Level X+1" button and a secondary "← Back to Level X−1" button.

No schema changes. One new server method + endpoint, then `Read.tsx` gets the new UI.

---

## Step 1 — Add `getLastReadPassageInLevel` to storage

**File: `server/storage.ts`**

### 1a — Add method to the `IStorage` interface

```ts
// Add to the IStorage interface:
getLastReadPassageInLevel(userId: number, level: number): Promise<number | null>;
```

### 1b — Add method to the `DatabaseStorage` class

Add this anywhere inside the class (e.g. after `upsertReadingProgress`):

```ts
async getLastReadPassageInLevel(userId: number, level: number): Promise<number | null> {
  // Join userReadingProgress with passage to filter by readingLevel,
  // then return the passageId the user visited most recently in that level.
  const rows = await db
    .select({
      passageId: userReadingProgress.passageId,
      completedAt: userReadingProgress.completedAt,
    })
    .from(userReadingProgress)
    .innerJoin(passage, eq(userReadingProgress.passageId, passage.passageId))
    .where(
      and(
        eq(userReadingProgress.userId, userId),
        eq(passage.readingLevel, level)
      )
    )
    .orderBy(desc(userReadingProgress.completedAt))
    .limit(1);

  return rows.length > 0 ? rows[0].passageId : null;
}
```

Make sure `passage` is imported at the top of `storage.ts` (it already is in the existing imports).

---

## Step 2 — Add the level progress endpoint

**File: `server/routes.ts`**

Add this route inside `registerRoutes()`, alongside the other reading-progress routes:

```ts
// Returns the last-read passageId for a given level (for jump-to-level)
app.get("/api/reading-progress/level/:level", async (req, res) => {
  const userId = req.session.userId || 1;
  const level = Number(req.params.level);
  if (!level || isNaN(level)) {
    return res.status(400).json({ message: "Invalid level" });
  }
  const passageId = await storage.getLastReadPassageInLevel(userId, level);
  res.json({ passageId });
});
```

---

## Step 3 — Rewrite `Read.tsx`

**File: `client/src/pages/Read.tsx`**

Replace the entire file with the version below. Changes vs the previous version are:
- Level badge replaced with a **tappable dropdown** showing all 6 levels.
- Progress counter shows **within-level position** (e.g. "3 / 10") instead of global.
- **"Feeling ready for the next level?"** banner renders on the last story of a level.
- Dropdown jump calls `/api/reading-progress/level/:level` to resume last position.
- The word-click popup and all vocab functionality are **100% unchanged**.

```tsx
import { Layout } from "@/components/Layout";
import {
  useReadingPassages,
  useCurrentReadingProgress,
  useSaveReadingProgress,
} from "@/hooks/use-reading";
import { motion, AnimatePresence } from "framer-motion";
import {
  Book,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useWords, useWordLookup } from "@/hooks/use-words";
import {
  useVocabLists,
  useCreateVocabList,
  useAddWordToVocabList,
} from "@/hooks/use-vocab-lists";
import { CreateVocabListDialog } from "@/components/CreateVocabListDialog";
import type { Passage } from "@shared/schema";

// ─── Level helpers ──────────────────────────────────────────────────────────

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

// ─── Clickable word ──────────────────────────────────────────────────────────

function ClickableWord({
  word,
  onClick,
}: {
  word: string;
  onClick: (w: string) => void;
}) {
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

// ─── Main component ──────────────────────────────────────────────────────────

export default function Read() {
  const { data: passages, isLoading } = useReadingPassages();
  const { data: savedPassageId } = useCurrentReadingProgress();
  const saveProgress = useSaveReadingProgress();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressInitialized, setProgressInitialized] = useState(false);

  // Level dropdown open/close
  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Word popup state
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  // Vocab state
  const { data: vocabWords } = useWords();
  const { data: lookedUpWord, isLoading: isLookingUp } = useWordLookup(selectedWord);
  const { data: lists } = useVocabLists();
  const createList = useCreateVocabList();
  const addWordToList = useAddWordToVocabList();
  const [selectedListId, setSelectedListId] = useState<number | "">("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // ── Init from saved progress ─────────────────────────────────────────────
  useEffect(() => {
    if (!progressInitialized && passages && passages.length > 0 && savedPassageId !== undefined) {
      if (savedPassageId !== null) {
        const idx = passages.findIndex((p) => (p as any).passageId === savedPassageId);
        if (idx >= 0) setCurrentIndex(idx);
      }
      setProgressInitialized(true);
    }
  }, [passages, savedPassageId, progressInitialized]);

  // ── Save progress on index change ────────────────────────────────────────
  useEffect(() => {
    if (!progressInitialized || !passages || passages.length === 0) return;
    const current = passages[currentIndex] as any;
    if (current?.passageId) saveProgress.mutate(current.passageId);
  }, [currentIndex, progressInitialized]); // eslint-disable-line

  // ── Close dropdown when clicking outside ─────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLevelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const passage = (passages?.[currentIndex] as Passage | undefined) || {
    passageId: 0,
    title: "The Morning Routine",
    bodyText:
      "Every morning, Sarah wakes up at 7:00 AM. She brushes her teeth and washes her face. Then, she goes to the kitchen to make breakfast. She usually eats toast with jam and drinks a cup of coffee. After breakfast, she gets dressed and walks to the bus stop to go to work.",
    readingLevel: 1,
    audioUrl: null,
    id: 0,
    content: "Every morning, Sarah wakes up at 7:00 AM.",
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

  const levelNum = passage?.readingLevel ?? 1;
  const levelLabel = LEVEL_LABELS[levelNum] ?? `Level ${levelNum}`;
  const levelDesc = LEVEL_DESCRIPTIONS[levelNum] ?? "";

  // Within-level progress
  const levelPassages = useMemo(
    () => (passages ?? []).filter((p) => (p as any).readingLevel === levelNum),
    [passages, levelNum]
  );
  const levelIndex = levelPassages.findIndex(
    (p) => (p as any).passageId === (passage as any).passageId
  );
  const levelPosition = levelIndex >= 0 ? levelIndex + 1 : 1;
  const levelTotal = levelPassages.length;
  const isLastInLevel = levelIndex === levelTotal - 1;
  const isFirstInLevel = levelIndex === 0;

  // All unique levels present in data
  const allLevels = useMemo(() => {
    if (!passages) return [1, 2, 3, 4, 5, 6];
    const nums = [...new Set((passages as any[]).map((p) => p.readingLevel as number))].sort(
      (a, b) => a - b
    );
    return nums.length > 0 ? nums : [1, 2, 3, 4, 5, 6];
  }, [passages]);

  const wordCount = words.filter(Boolean).length;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 130));
  const readTimeLabel = `${readMinutes} min read`;

  // ── Navigation helpers ────────────────────────────────────────────────────
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

  // Jump to a specific level — resume last-read story or fall back to first
  const handleLevelJump = async (level: number) => {
    setLevelDropdownOpen(false);
    if (!passages) return;

    try {
      const res = await fetch(`/api/reading-progress/level/${level}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.passageId) {
          const idx = passages.findIndex((p) => (p as any).passageId === data.passageId);
          if (idx >= 0) {
            setCurrentIndex(idx);
            setSelectedWord(null);
            return;
          }
        }
      }
    } catch (_) {
      // fall through to first-story fallback
    }

    // Fallback: go to first story in the selected level
    const firstIdx = passages.findIndex((p) => (p as any).readingLevel === level);
    if (firstIdx >= 0) {
      setCurrentIndex(firstIdx);
      setSelectedWord(null);
    }
  };

  // Advance to next level (first story of next level, or resume if visited)
  const handleNextLevel = () => handleLevelJump(levelNum + 1);

  // Return to previous level (last-read or first story)
  const handlePrevLevel = () => handleLevelJump(levelNum - 1);

  // ── Matching word for popup ───────────────────────────────────────────────
  const matchingWord = useMemo(() => {
    if (lookedUpWord) return lookedUpWord;
    if (!selectedWord || !vocabWords) return null;
    const clean = selectedWord.toLowerCase();
    return (vocabWords as any[]).find((w) => w.term.toLowerCase() === clean) || null;
  }, [lookedUpWord, selectedWord, vocabWords]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout title="Reading Practice">
      <div className="space-y-6">
        {/* Header Image */}
        <div className="relative h-48 rounded-3xl overflow-hidden shadow-lg">
          <img src={imageUrl} alt="Reading context" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
            {/* Level dropdown badge */}
            <div className="relative w-fit mb-2" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setLevelDropdownOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs font-bold text-primary-foreground bg-primary/90 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-primary transition-colors"
              >
                {levelLabel} · {levelDesc}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${levelDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown panel */}
              <AnimatePresence>
                {levelDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-20"
                  >
                    {allLevels.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleLevelJump(lvl)}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/70 flex items-center justify-between ${
                          lvl === levelNum
                            ? "bg-primary/10 text-primary"
                            : "text-foreground/80"
                        }`}
                      >
                        <span>{LEVEL_LABELS[lvl]}</span>
                        <span className="text-xs text-muted-foreground">
                          {LEVEL_DESCRIPTIONS[lvl]}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <h2 className="text-2xl font-bold text-white">{passage.title}</h2>
          </div>
        </div>

        {/* Stats Row — within-level progress */}
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
          {/* Within-level story counter */}
          <span className="text-xs font-semibold tabular-nums">
            {levelPosition} / {levelTotal}
          </span>
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

        {/* "Feeling ready for the next level?" banner — only on last story */}
        <AnimatePresence>
          {isLastInLevel && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="bg-primary/10 border border-primary/20 rounded-2xl p-5 space-y-3"
            >
              <p className="text-sm font-semibold text-primary">
                🎉 You've finished {levelLabel}!
              </p>
              <p className="text-sm text-foreground/70">
                Feeling ready for{" "}
                <span className="font-medium text-foreground">
                  {LEVEL_LABELS[levelNum + 1] ?? "the next challenge"}
                </span>
                ?
              </p>
              <div className="flex gap-3 flex-wrap">
                {/* Advance to next level */}
                {levelNum < 6 && (
                  <button
                    type="button"
                    onClick={handleNextLevel}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Go to {LEVEL_LABELS[levelNum + 1]}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {/* Return to previous level */}
                {levelNum > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevLevel}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to {LEVEL_LABELS[levelNum - 1]}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Story Navigation — Back / Next (within full list) */}
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

      {/* ── Word Definition Popup (UNCHANGED) ──────────────────────────── */}
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
                    <h3 className="text-2xl font-bold font-display capitalize mb-1">
                      {selectedWord}
                    </h3>
                    <p className="text-sm text-muted-foreground italic">
                      {matchingWord?.phonetic
                        ? `noun • ${matchingWord.phonetic}`
                        : "noun"}
                    </p>
                  </div>
                  <AudioPlayer
                    text={selectedWord}
                    className="bg-primary/10 text-primary w-12 h-12"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Definition
                    </h4>
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {matchingWord.phonetic}
                      </p>
                    )}
                  </div>
                  <div className="bg-secondary/50 p-3 rounded-xl">
                    <p className="text-sm italic text-muted-foreground">
                      "Try using{" "}
                      <span className="text-primary font-medium">{selectedWord}</span> in
                      a sentence you'd say today."
                    </p>
                  </div>
                </div>

                {/* Add to Vocab */}
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Add to Vocab
                  </p>
                  <div className="space-y-2">
                    <select
                      value={selectedListId}
                      onChange={(e) =>
                        setSelectedListId(e.target.value ? Number(e.target.value) : "")
                      }
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

## Summary of all changes

| File | What changed |
|---|---|
| `server/storage.ts` | Added `getLastReadPassageInLevel` method to interface + class |
| `server/routes.ts` | Added `GET /api/reading-progress/level/:level` endpoint |
| `client/src/pages/Read.tsx` | Full rewrite — level dropdown, within-level counter, level-up banner |

No `db:push` needed. No schema changes.

---

## Behaviour notes

**Progress counter** (`X / 10`): counts only passages with the same `readingLevel` as the current story. The Treasure Island passage (level 2, storyOrder 0) counts toward Level 2's total, so that level may show "X / 11".

**Level dropdown**: tapping the level badge opens a panel listing all 6 levels. The current level is highlighted. Selecting one calls `/api/reading-progress/level/:level` and jumps to the last-read story there, or falls back to the first story of that level if never visited.

**"Feeling ready for the next level?" banner**: rendered only when `isLastInLevel` is true (levelIndex === levelTotal - 1). Shows "Go to Level X+1" and, if not on level 1, "Back to Level X−1". Both buttons use the same `handleLevelJump` helper.

**Back/Next buttons** at the bottom still step through the global list one story at a time — useful for moving across the level boundary naturally.
