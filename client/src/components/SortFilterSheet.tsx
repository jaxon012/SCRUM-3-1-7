import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export type SortOption = "az" | "za" | "mastery";
export type StatusFilter = "new" | "learned" | "mastered";

interface VocabListOption {
  vocabListId: number;
  name: string;
}

interface SortFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filterStatuses: StatusFilter[];
  onFilterChange: (statuses: StatusFilter[]) => void;
  lists?: VocabListOption[];
  selectedListIds: number[];
  onListFilterChange: (listIds: number[]) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "az", label: "A \u2192 Z" },
  { value: "za", label: "Z \u2192 A" },
  { value: "mastery", label: "Mastery Level" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
  { value: "mastered", label: "Mastered", color: "bg-[#6B9E78]" },
  { value: "learned", label: "Learned", color: "bg-[#B8A832]" },
  { value: "new", label: "New", color: "bg-[#C97B4B]" },
];

export function SortFilterSheet({
  isOpen, onClose, sortBy, onSortChange, filterStatuses, onFilterChange,
  lists, selectedListIds, onListFilterChange,
}: SortFilterSheetProps) {
  const toggleStatus = (status: StatusFilter) => {
    if (filterStatuses.includes(status)) {
      if (filterStatuses.length === 1) return;
      onFilterChange(filterStatuses.filter(s => s !== status));
    } else {
      onFilterChange([...filterStatuses, status]);
    }
  };

  const toggleList = (listId: number) => {
    if (selectedListIds.includes(listId)) {
      if (selectedListIds.length === 1) return;
      onListFilterChange(selectedListIds.filter(id => id !== listId));
    } else {
      onListFilterChange([...selectedListIds, listId]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 p-4 z-50 flex justify-center pointer-events-none"
          >
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-border/50 p-6 pointer-events-auto pb-24 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold">Sort & Filter</h3>
                <button onClick={onClose} className="p-1 hover:bg-secondary rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Sort */}
              <div className="mb-6">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Sort By</p>
                <div className="grid grid-cols-3 gap-2">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => onSortChange(opt.value)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                        sortBy === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/60 text-foreground hover:bg-secondary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter by status */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Filter by Status</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => toggleStatus(opt.value)}
                      className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
                        filterStatuses.includes(opt.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/60 text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {lists && lists.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Filter by List</p>
                  <div className="flex flex-wrap gap-2">
                    {lists.map(list => (
                      <button
                        key={list.vocabListId}
                        onClick={() => toggleList(list.vocabListId)}
                        className={`py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
                          selectedListIds.includes(list.vocabListId)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/60 text-foreground hover:bg-secondary"
                        }`}
                      >
                        {list.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={onClose} className="w-full mt-6 bg-primary text-primary-foreground font-bold py-3 rounded-xl">
                Apply
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
