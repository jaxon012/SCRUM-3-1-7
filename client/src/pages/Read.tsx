import { Layout } from "@/components/Layout";
import { useReadingPassages } from "@/hooks/use-reading";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Clock, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useWords } from "@/hooks/use-words";
import { useVocabLists, useCreateVocabList, useAddWordToVocabList } from "@/hooks/use-vocab-lists";
import { CreateVocabListDialog } from "@/components/CreateVocabListDialog";
import type { Passage } from "@shared/schema";

// Interactive word component
function ClickableWord({ word, onClick }: { word: string; onClick: (w: string) => void }) {
  // Strip punctuation for clean lookup
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
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const { data: vocabWords } = useWords();
  const { data: lists } = useVocabLists();
  const createList = useCreateVocabList();
  const addWordToList = useAddWordToVocabList();
  const [selectedListId, setSelectedListId] = useState<number | "">("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // For prototype, we'll just use the first passage or a fallback
  const passage = (passages?.[0] as Passage | undefined) || {
    passageId: 0,
    title: "The Morning Routine",
    bodyText: "Every morning, Sarah wakes up at 7:00 AM. She brushes her teeth and washes her face. Then, she goes to the kitchen to make breakfast. She usually eats toast with jam and drinks a cup of coffee. After breakfast, she gets dressed and walks to the bus stop to go to work.",
    readingLevel: 1,
    audioUrl: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&q=80",
    // Compatibility fields
    id: 0,
    content: "Every morning, Sarah wakes up at 7:00 AM. She brushes her teeth and washes her face. Then, she goes to the kitchen to make breakfast. She usually eats toast with jam and drinks a cup of coffee. After breakfast, she gets dressed and walks to the bus stop to go to work.",
    level: "Beginner",
    imageUrl: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&q=80"
  } as Passage;

  const content = (passage as any).content || passage.bodyText || "";
  const words = content.split(" ");
  const imageUrl = ((passage as any).imageUrl || passage.audioUrl || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80") as string;
  const level = ((passage as any).level || passage.readingLevel?.toString() || "Beginner") as string;

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
          {/* Morning coffee scene */}
          <img 
            src={imageUrl} 
            alt="Reading context" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
            <span className="text-xs font-bold text-primary-foreground bg-primary/90 px-2 py-1 rounded-md w-fit mb-2 backdrop-blur-sm">
              {level}
            </span>
            <h2 className="text-2xl font-bold text-white">{passage.title}</h2>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>3 min read</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Book className="w-4 h-4" />
            <span>{words.length} words</span>
          </div>
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
      </div>

      {/* Word Definition Popup */}
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
                      "Try using <span className="text-primary font-medium">{selectedWord}</span> in a sentence you’d say today."
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
