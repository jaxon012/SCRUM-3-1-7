import { Layout } from "@/components/Layout";
import { WordCard } from "@/components/WordCard";
import { useWords } from "@/hooks/use-words";
import { useVocabLists, useVocabListWords, useCreateVocabList } from "@/hooks/use-vocab-lists";
import { Search, Filter, ChevronDown, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CreateVocabListDialog } from "@/components/CreateVocabListDialog";
import { SortFilterSheet, type SortOption, type StatusFilter } from "@/components/SortFilterSheet";

export default function Vocab() {
  const { data: words, isLoading, isError, error } = useWords();
  const { data: lists } = useVocabLists();
  const createList = useCreateVocabList();

  const [search, setSearch] = useState("");
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const { data: listWords } = useVocabListWords(selectedListId ?? undefined);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSortFilter, setShowSortFilter] = useState(false);

  const [sortBy, setSortBy] = useState<SortOption>(() => {
    try { return (JSON.parse(localStorage.getItem("lingoquest_sort_prefs") || "{}").sortBy) || "az"; }
    catch { return "az"; }
  });
  const [filterStatuses, setFilterStatuses] = useState<StatusFilter[]>(() => {
    try { return JSON.parse(localStorage.getItem("lingoquest_sort_prefs") || "{}").filterStatuses || ["new", "learned", "mastered"]; }
    catch { return ["new", "learned", "mastered"]; }
  });

  const [selectedListIds, setSelectedListIds] = useState<number[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("lingoquest_sort_prefs") || "{}");
      return stored.selectedListIds || [];
    } catch { return []; }
  });

  const updatePrefs = (newSort: SortOption, newStatuses: StatusFilter[], newListIds: number[]) => {
    localStorage.setItem("lingoquest_sort_prefs", JSON.stringify({
      sortBy: newSort,
      filterStatuses: newStatuses,
      selectedListIds: newListIds,
    }));
  };


  useEffect(() => {
    // Used by Home's "Practice this word" button.
    const key = "lingoquest_featured_word";
    const featured = localStorage.getItem(key);
    if (featured) {
      setSearch(featured);
      localStorage.removeItem(key);
    }
  }, []);

  const sourceWords = selectedListId ? listWords : words;

  const filteredWords = useMemo(() => {
    if (!sourceWords) return [];

    let result = sourceWords.filter((w: any) =>
      w.term.toLowerCase().includes(search.toLowerCase()) ||
      w.definition.toLowerCase().includes(search.toLowerCase())
    );

    result = result.filter((w: any) => {
      const status = w.userWordProgress?.status || "new";
      return filterStatuses.includes(status as StatusFilter);
    });

    return [...result].sort((a: any, b: any) => {
      if (sortBy === "az") return a.term.localeCompare(b.term);
      if (sortBy === "za") return b.term.localeCompare(a.term);
      if (sortBy === "mastery") {
        const order = { mastered: 0, learned: 1, new: 2 };
        const aS = (a.userWordProgress?.status || "new") as keyof typeof order;
        const bS = (b.userWordProgress?.status || "new") as keyof typeof order;
        return order[aS] - order[bS];
      }
      return 0;
    });
  }, [sourceWords, search, sortBy, filterStatuses]);

  // Calculate stats from the currently selected list (or all words).
  const statsWords = (sourceWords || []) as any[];
  const masteredCount = statsWords.filter((w) => w.userWordProgress?.status === "mastered").length || 0;
  const newCount =
    statsWords.filter(
      (w) => !w.userWordProgress || w.userWordProgress?.status === "new",
    ).length || 0;

  return (
    <Layout title="Vocabulary">
      {/* Top Bar: Search + My Lists */}
      <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-2 -mx-4 px-4 mb-4 border-b border-border/50 flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search words..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border-transparent focus:bg-background focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all outline-none text-sm font-medium"
          />
          <button
            onClick={() => setShowSortFilter(true)}
            aria-label="Filter and sort words"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-background rounded-lg transition-colors text-muted-foreground"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* My Lists selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              My Lists
            </span>
            <div className="relative">
              <select
                value={selectedListId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedListId(value ? Number(value) : null);
                }}
                aria-label="Filter by vocabulary list"
                className="pl-3 pr-8 py-1.5 rounded-full bg-secondary/60 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
              >
                <option value="">All Words</option>
                {lists?.map((list) => (
                  <option key={list.vocabListId} value={list.vocabListId}>
                    {list.name}{list.wordCount !== undefined ? ` (${list.wordCount})` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-foreground/80 px-3 py-1 rounded-full border border-foreground/30 bg-foreground/5"
          >
            <Plus className="w-3 h-3" />
            Create New List
          </button>
        </div>
      </div>

      {/* Stats Header */}
      <div className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <div className="bg-[#6B9E78]/20 border border-[#6B9E78]/50 px-4 py-3 rounded-2xl min-w-[120px]">
          <p className="text-xs font-semibold text-[#2d5c3a] mb-1">MASTERED</p>
          <p className="text-2xl font-display font-bold text-[#2d5c3a]">{masteredCount}</p>
        </div>
        <div className="bg-[#C97B4B]/20 border border-[#C97B4B]/50 px-4 py-3 rounded-2xl min-w-[120px]">
          <p className="text-xs font-semibold text-[#7a3a15] mb-1">NEW</p>
          <p className="text-2xl font-display font-bold text-[#7a3a15]">{newCount}</p>
        </div>
      </div>

      {/* Words List */}
      <h2 className="sr-only">Words</h2>
      <div className="space-y-3">
        {isError ? (
          <div className="text-center py-12 text-destructive">
            <p>Failed to load words: {error?.message}</p>
            <p className="text-sm text-muted-foreground mt-2">Check the console and ensure the server is running.</p>
          </div>
        ) : isLoading ? (
          // Skeleton Loading
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-secondary/50 rounded-2xl animate-pulse" />
          ))
        ) : filteredWords?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No words found matching "{search}"</p>
          </div>
        ) : (
          filteredWords?.map((word, index) => (
            <WordCard key={word.wordId} word={word} index={index} />
          ))
        )}
      </div>
      <CreateVocabListDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={async (name) => {
          const created = await createList.mutateAsync(name);
          setSelectedListId(created.vocabListId);
        }}
      />
      <SortFilterSheet
        isOpen={showSortFilter}
        onClose={() => setShowSortFilter(false)}
        sortBy={sortBy}
        onSortChange={(s) => { setSortBy(s); updatePrefs(s, filterStatuses, selectedListIds); }}
        filterStatuses={filterStatuses}
        onFilterChange={(f) => { setFilterStatuses(f); updatePrefs(sortBy, f, selectedListIds); }}
        lists={lists ?? []}
        selectedListIds={selectedListIds}
        onListFilterChange={(ids) => {
          setSelectedListIds(ids);
          updatePrefs(sortBy, filterStatuses, ids);
          if (ids.length === 1) {
            setSelectedListId(ids[0]);
          } else if (ids.length === 0) {
            setSelectedListId(null);
          }
        }}
      />
    </Layout>
  );
}
