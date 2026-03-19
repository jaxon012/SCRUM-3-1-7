import { Layout } from "@/components/Layout";
import { WordCard } from "@/components/WordCard";
import { useWords } from "@/hooks/use-words";
import { useVocabLists, useVocabListWords, useCreateVocabList } from "@/hooks/use-vocab-lists";
import { Search, Filter, ChevronDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { CreateVocabListDialog } from "@/components/CreateVocabListDialog";

export default function Vocab() {
  const { data: words, isLoading, isError, error } = useWords();
  const { data: lists } = useVocabLists();
  const createList = useCreateVocabList();

  const [search, setSearch] = useState("");
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const { data: listWords } = useVocabListWords(selectedListId ?? undefined);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  console.log("Vocab page - words data:", words);

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

  const filteredWords = sourceWords?.filter((w: any) => 
    w.term.toLowerCase().includes(search.toLowerCase()) || 
    w.definition.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate stats from the words with progress
  const learnedCount = words?.filter(w => w.userWordProgress?.status === "learned").length || 0;
  const masteredCount = words?.filter(w => w.userWordProgress?.status === "mastered").length || 0;
  const newCount = words?.filter(w => !w.userWordProgress || w.userWordProgress?.status === "new").length || 0;

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
          <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-background rounded-lg transition-colors text-muted-foreground">
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
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 px-3 py-1 rounded-full border border-primary/40 bg-primary/5"
          >
            <Plus className="w-3 h-3" />
            Create New List
          </button>
        </div>
      </div>

      {/* Stats Header */}
      <div className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <div className="bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-2xl min-w-[120px]">
          <p className="text-xs font-semibold text-green-600 mb-1">MASTERED</p>
          <p className="text-2xl font-display font-bold text-green-700">{masteredCount}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-3 rounded-2xl min-w-[120px]">
          <p className="text-xs font-semibold text-blue-600 mb-1">LEARNED</p>
          <p className="text-2xl font-display font-bold text-blue-700">{learnedCount}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-3 rounded-2xl min-w-[120px]">
          <p className="text-xs font-semibold text-purple-600 mb-1">NEW</p>
          <p className="text-2xl font-display font-bold text-purple-700">{newCount}</p>
        </div>
      </div>

      {/* Words List */}
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
    </Layout>
  );
}
