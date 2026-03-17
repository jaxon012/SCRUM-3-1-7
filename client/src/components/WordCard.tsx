import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, Check } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import { useUpdateWordProgress } from "@/hooks/use-word-progress";
import type { Word } from "@shared/schema";

interface WordCardProps {
  word: Word & { userWordProgress?: any };
  index: number;
}

export function WordCard({ word, index }: WordCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { mutate: updateProgress, isPending } = useUpdateWordProgress();

  const userWordId = word.userWordProgress?.userWordId;
  const status = word.userWordProgress?.status || "new";
  const isMastered = status === "mastered";


  const handleMarkAsMastered = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card collapse when clicking the button
    if (userWordId) {
      updateProgress({ userWordId });
    } else {
      console.warn("userWordId is undefined - no progress record for this word");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
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
                ? 'bg-green-500/10 text-green-600' 
                : 'bg-primary/10 text-primary'
              }
            `}
          >
            {isMastered ? (
              <Check className="w-5 h-5" />
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
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Definition</span>
                <p className="text-sm text-foreground/80 leading-relaxed">{word.definition}</p>
              </div>

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

              <button
                onClick={handleMarkAsMastered}
                disabled={isMastered || isPending}
                className={`
                  w-full py-2 px-4 rounded-xl font-semibold text-sm transition-all
                  ${isMastered
                    ? "bg-green-500/20 text-green-600 cursor-default"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
                  }
                `}
              >
                {isPending ? "Updating..." : isMastered ? "✓ Mastered" : "Mark as Mastered"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
