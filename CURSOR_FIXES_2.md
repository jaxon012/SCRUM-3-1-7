# Two Fixes — Cursor Implementation Guide

## Fix 1 — Level dropdown gets clipped

### Root cause
The level badge sits inside the image div which has `overflow-hidden rounded-3xl`. Any `absolute` child that extends beyond the image boundary is clipped. The fix is to render the dropdown panel via `createPortal` so it mounts directly on `document.body`, outside the clipping context, then position it with `fixed` coordinates derived from the button's `getBoundingClientRect()`.

### Changes — `client/src/pages/Read.tsx`

#### 1a — Add `createPortal` to the React DOM import

```tsx
// Add createPortal to the existing react-dom import (or add new import):
import { createPortal } from "react-dom";
```

#### 1b — Add a ref for the badge button and a position state

Inside the `Read` component, alongside the existing `dropdownRef` and `levelDropdownOpen` state, add:

```tsx
const badgeButtonRef = useRef<HTMLButtonElement>(null);
const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
```

#### 1c — Compute position when opening the dropdown

Replace the button's `onClick` handler so it calculates the position before opening:

```tsx
// BEFORE:
onClick={() => setLevelDropdownOpen((o) => !o)}

// AFTER:
onClick={() => {
  if (badgeButtonRef.current) {
    const rect = badgeButtonRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 8, left: rect.left });
  }
  setLevelDropdownOpen((o) => !o);
}}
```

Also add `ref={badgeButtonRef}` to that same button element:

```tsx
// The badge button should now look like:
<button
  ref={badgeButtonRef}
  type="button"
  onClick={() => {
    if (badgeButtonRef.current) {
      const rect = badgeButtonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
    setLevelDropdownOpen((o) => !o);
  }}
  className="flex items-center gap-1.5 text-xs font-bold text-primary-foreground bg-primary/90 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-primary transition-colors"
>
  {levelLabel} · {levelDesc}
  <ChevronDown
    className={`w-3.5 h-3.5 transition-transform ${levelDropdownOpen ? "rotate-180" : ""}`}
  />
</button>
```

#### 1d — Remove the dropdown panel from inside the image div

Find the `<AnimatePresence>` block that renders the dropdown panel (the `motion.div` with the level list) and **delete it entirely** from inside the image container. Also remove the outer `<div className="relative w-fit mb-2" ref={dropdownRef}>` wrapper — the badge button can sit on its own now:

```tsx
{/* The image overlay area should just have the badge button, no wrapper div, no dropdown panel: */}
<div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
  <button
    ref={badgeButtonRef}
    type="button"
    onClick={() => {
      if (badgeButtonRef.current) {
        const rect = badgeButtonRef.current.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 8, left: rect.left });
      }
      setLevelDropdownOpen((o) => !o);
    }}
    className="flex items-center gap-1.5 text-xs font-bold text-primary-foreground bg-primary/90 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-primary transition-colors w-fit mb-2"
  >
    {levelLabel} · {levelDesc}
    <ChevronDown
      className={`w-3.5 h-3.5 transition-transform ${levelDropdownOpen ? "rotate-180" : ""}`}
    />
  </button>
  <h2 className="text-2xl font-bold text-white">{passage.title}</h2>
</div>
```

#### 1e — Render the dropdown via createPortal at the bottom of the JSX

Add this block **outside** the main `<div className="space-y-6">` container, just before the word popup `<AnimatePresence>`. It renders the panel via a portal so it's never clipped:

```tsx
{/* Level dropdown portal — renders on document.body to escape overflow:hidden */}
{typeof document !== "undefined" && createPortal(
  <AnimatePresence>
    {levelDropdownOpen && (
      <>
        {/* Invisible backdrop to close on outside click */}
        <div
          className="fixed inset-0 z-[998]"
          onClick={() => setLevelDropdownOpen(false)}
        />
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: 220,
            zIndex: 999,
          }}
          className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
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
      </>
    )}
  </AnimatePresence>,
  document.body
)}
```

#### 1f — Remove the old `dropdownRef` ref and its `useEffect`

Since the backdrop `<div>` in the portal handles outside-click closes, you can delete:
- The `const dropdownRef = useRef<HTMLDivElement>(null);` declaration
- The `useEffect` that added the `mousedown` event listener for `handleClickOutside`

---

## Fix 2 — Adventure page word definitions

### Root cause
`AdventureWordModal` has a hardcoded string `"In a full version, this definition would come from the main vocab data."`. It never calls the lookup API.

### Changes — `client/src/pages/Adventure.tsx`

#### 2a — Add `useWordLookup` to the import

```tsx
// BEFORE:
import { useWords } from "@/hooks/use-words";

// AFTER:
import { useWords, useWordLookup } from "@/hooks/use-words";
```

#### 2b — Add the hook to `AdventureWordModal`

`AdventureWordModal` is a function component that always renders (it returns null internally for the no-word case). Add the hook call **before** the early return:

```tsx
function AdventureWordModal({
  selectedWord,
  onClose,
  vocabWords,
  lists,
  addWordToList,
  selectedListId,
  setSelectedListId,
  onOpenCreateDialog,
}: AdventureWordModalProps) {
  // ── Add these two lines BEFORE the early return ──
  const { data: lookedUpWord, isLoading: isLookingUp } = useWordLookup(selectedWord);

  const clean = selectedWord?.toLowerCase() ?? "";
  const matchingWord =
    lookedUpWord ||
    vocabWords?.find((w) => w.term.toLowerCase() === clean) ||
    null;
  // ── End new lines ──

  if (!selectedWord) return null;

  // ... rest of the component unchanged
```

> **Important:** Move the existing `const clean = ...` and `const matchingWord = ...` lines that are currently after the `if (!selectedWord) return null` check to **before** it, as shown above. Hooks must be called before any early return.

#### 2c — Replace the hardcoded definition with the real one

Find this block in `AdventureWordModal`:

```tsx
<div className="space-y-4">
  <div>
    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
      Definition
    </h4>
    <p className="text-foreground/90">
      In a full version, this definition would come from the main
      vocab data.
    </p>
  </div>
</div>
```

Replace it with:

```tsx
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
```

#### 2d — Update the `AdventureWordModalProps` interface

The `matchingWord` is now computed inside the modal, so no props change is needed. Just verify the existing `vocabWords` prop is still passed from the parent (it is, no parent changes needed).

---

## Summary

| File | Fix |
|---|---|
| `client/src/pages/Read.tsx` | Portal-based dropdown escapes `overflow:hidden` clipping |
| `client/src/pages/Adventure.tsx` | `useWordLookup` wired into `AdventureWordModal`; hardcoded text replaced |

No backend changes. No `db:push` needed.
