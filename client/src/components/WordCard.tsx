import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, Check } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import { useMarkWordAsMasteredByWordId, useUpdateWordProgress } from "@/hooks/use-word-progress";
import { useVocabLists, useAddWordToVocabList, useCreateVocabList } from "@/hooks/use-vocab-lists";
import { useAddWordToVocab } from "@/hooks/use-add-to-vocab";
import { CreateVocabListDialog } from "./CreateVocabListDialog";
import { useToast } from "@/hooks/use-toast";
import type { Word } from "@shared/schema";

interface WordCardProps {
  word: Word & { userWordProgress?: any };
  index: number;
}

export function WordCard({ word, index }: WordCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const { mutate: updateProgress, isPending: isUpdatePending } = useUpdateWordProgress();
  const { mutate: markMasteredByWordId, isPending: isMarkPending } = useMarkWordAsMasteredByWordId();
  const { data: lists } = useVocabLists();
  const addWordToList = useAddWordToVocabList();
  const addWordToVocab = useAddWordToVocab();
  const createList = useCreateVocabList();
  const [selectedListId, setSelectedListId] = useState<number | "">("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const userWordId = word.userWordProgress?.userWordId;
  const status = word.userWordProgress?.status || "new";
  const isMastered = status === "mastered";


  const handleMarkAsMastered = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card collapse when clicking the button
    if (userWordId) {
      updateProgress({ userWordId });
      return;
    }

    // In vocab-list mode, list words may not include a `userWordId` yet.
    // Fall back to marking mastered by `wordId` (server will create progress if missing).
    markMasteredByWordId({ wordId: word.wordId });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.15) }}
      className={`
        bg-card rounded-2xl border border-border/50 shadow-sm
        hover:shadow-md hover:border-primary/20 transition-all duration-300
        overflow-hidden
      `}
    >
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-4 flex-1">
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg overflow-hidden
              ${isMastered
                ? 'bg-[#6B9E78]/25 text-[#2d5c3a]'
                : 'bg-primary/10 text-primary'
              }
            `}
          >
            {isMastered ? (
              <Check className="w-5 h-5" />
            ) : word.imageUrl ? (
              <img
                src={word.imageUrl}
                alt={word.term}
                width={40}
                height={40}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              word.term.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground leading-tight">{word.term}</h3>
            <p className="text-sm text-muted-foreground">
              {isMastered ? "✓ Mastered" : `Status: ${status}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <AudioPlayer text={word.term} />
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-muted-foreground/60" />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-secondary/30 border-t border-border/50"
          >
            <div className="p-4 space-y-4 pb-6 w-full max-w-md mx-auto">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Definition</span>
                <p className="text-sm text-foreground/80 leading-relaxed">{word.definition}</p>
              </div>

              {word.imageUrl && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Picture</span>
                  <img
                    src={word.imageUrl}
                    alt={word.term}
                    width={320}
                    height={160}
                    loading="lazy"
                    className="block w-full max-w-[min(100%,300px)] md:max-w-[280px] max-h-48 md:max-h-40 object-cover rounded-xl border border-border/60 mx-auto md:mx-0"
                  />
                </div>
              )}

              {word.phonetic && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Pronunciation</span>
                  <p className="text-sm text-muted-foreground">{word.phonetic}</p>
                </div>
              )}

              {word.userWordProgress && (
                <div className="bg-background rounded-xl p-3 border border-border/50">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Times Seen: {word.userWordProgress.timesSeen}</span>
                    {word.userWordProgress.lastSeenAt && (
                      <span className="text-muted-foreground">
                        Last: {new Date(word.userWordProgress.lastSeenAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleMarkAsMastered}
                  disabled={isMastered || isUpdatePending || isMarkPending}
                  className={`
                    w-full py-2 px-4 rounded-xl font-semibold text-sm transition-all
                    ${isMastered
                      ? "bg-[#6B9E78]/30 text-[#2d5c3a] cursor-default"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
                    }
                  `}
                >
                  {isUpdatePending || isMarkPending ? "Updating..." : isMastered ? "✓ Mastered" : "Mark as Mastered"}
                </button>

                {/* Add to vocab lists */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Add to Vocab List
                  </p>
                  <select
                    value={selectedListId}
                    onChange={(e) =>
                      setSelectedListId(e.target.value ? Number(e.target.value) : "")
                    }
                    aria-label="Choose a vocabulary list"
                    className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">All Words</option>
                    {lists?.map((list) => (
                      <option key={list.vocabListId} value={list.vocabListId}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        if (!selectedListId) {
                          await addWordToVocab.mutateAsync(word.term);
                        } else {
                          await addWordToList.mutateAsync({
                            listId: Number(selectedListId),
                            wordId: word.wordId,
                          });
                        }
                      } catch (err) {
                        console.error(err);
                        toast({
                          variant: "destructive",
                          title: "Could not add to list",
                          description:
                            err instanceof Error
                              ? err.message
                              : "Check that you are logged in and try again.",
                        });
                      }
                    }}
                    disabled={addWordToList.isPending || addWordToVocab.isPending}
                    className="w-full px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                  >
                    {addWordToList.isPending || addWordToVocab.isPending ? "Adding..." : "Add to Vocab"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateDialog(true);
                    }}
                    className="w-full text-xs font-semibold text-primary mt-1 hover:text-primary/80"
                  >
                    + Create New List
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <CreateVocabListDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={async (name) => {
          const created = await createList.mutateAsync(name);
          setSelectedListId(created.vocabListId);
          try {
            await addWordToList.mutateAsync({
              listId: created.vocabListId,
              wordId: word.wordId,
            });
          } catch (err) {
            console.error(err);
            toast({
              variant: "destructive",
              title: "Could not add to list",
              description:
                err instanceof Error
                  ? err.message
                  : "Check that you are logged in and try again.",
            });
          }
        }}
      />
    </motion.div>
  );
}
