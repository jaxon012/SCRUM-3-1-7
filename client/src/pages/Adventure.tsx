import { Layout } from "@/components/Layout";
import { useGameSession, useGenerateSceneImage } from "@/hooks/use-adventure";
import { useVoiceRecorder, useVoiceStream } from "@/replit_integrations/audio";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2, Send, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useWords } from "@/hooks/use-words";
import { useVocabLists, useCreateVocabList, useAddWordToVocabList } from "@/hooks/use-vocab-lists";
import { AudioPlayer } from "@/components/AudioPlayer";
import { CreateVocabListDialog } from "@/components/CreateVocabListDialog";

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export default function Adventure() {
  const { sessionId, createSession, isCreating } = useGameSession();
  const { mutate: generateImage, isPending: isGeneratingImage } = useGenerateSceneImage();
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const { data: vocabWords } = useWords();
  const { data: lists } = useVocabLists();
  const createList = useCreateVocabList();
  const addWordToList = useAddWordToVocabList();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<number | "">("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Game state
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "You find yourself at the edge of a mysterious forest. The trees whisper in a language you don't understand. A path splits in two: one leads towards a glowing cave (Cave), and the other towards a mountain peak (Mountain). What do you do?" }
  ]);
  const [textInput, setTextInput] = useState("");
  
  // Audio hooks
  const recorder = useVoiceRecorder();
  const stream = useVoiceStream({
    onUserTranscript: (text) => {
      addMessage('user', text);
    },
    onTranscript: (text, full) => {
      // Update the last assistant message with streaming text
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: full }];
        }
        return [...prev, { role: 'assistant', content: full }];
      });
    },
    onComplete: (fullText) => {
      // Generate new image based on the response
      generateImage(fullText, {
        onSuccess: (data) => setSceneImage(data.url)
      });
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-start session on mount
  useEffect(() => {
    if (!sessionId && !isCreating) {
      createSession.mutate();
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { role, content }]);
  };

  const handleVoiceInput = async () => {
    if (!sessionId) return;
    
    if (recorder.state === "recording") {
      const blob = await recorder.stopRecording();
      // Optimistic UI update handled by stream callbacks
      await stream.streamVoiceResponse(`/api/conversations/${sessionId}/messages`, blob);
    } else {
      await recorder.startRecording();
    }
  };

  const handleTextInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !sessionId) return;

    const content = textInput;
    setTextInput("");
    addMessage('user', content);

    // Send text message (backend handles TTS response if needed, but for now we'll assume text-only response for text input)
    // For this prototype, we'll mimic the voice flow but via a text endpoint if available.
    // Since we only set up voice routes in the example, we'll simulate a fetch to the chat endpoint
    
    try {
      const res = await fetch(`/api/conversations/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      // Handle streaming text response manually since useVoiceStream is for audio
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      
      // Add empty assistant message to fill
      addMessage('assistant', "");
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantMessage += data.content;
                setMessages(prev => {
                   const newMsgs = [...prev];
                   newMsgs[newMsgs.length - 1].content = assistantMessage;
                   return newMsgs;
                });
              }
            } catch (e) {}
          }
        }
      }
      
      // Generate image after text complete
      generateImage(assistantMessage, {
        onSuccess: (data) => setSceneImage(data.url)
      });
      
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout title="Adventure Mode" showBack>
      <div className="h-[calc(100vh-180px)] flex flex-col gap-4">
        
        {/* Dynamic Scene Image */}
        <div className="relative aspect-video rounded-3xl overflow-hidden shadow-lg border border-border bg-black/10 shrink-0">
          <AnimatePresence mode="wait">
            <motion.img
              key={sceneImage || "placeholder"}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              src={sceneImage || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80"} // Forest placeholder
              alt="Current scene"
              className="w-full h-full object-cover"
            />
          </AnimatePresence>
          
          {isGeneratingImage && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
          
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-white border border-white/10">
            Scene: The Mysterious Forest
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto space-y-4 px-1" ref={scrollRef}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
              <div 
                className={`
                  max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm
                  ${msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-white border border-border/50 text-foreground rounded-tl-none'}
                `}
              >
                {msg.role === 'assistant'
                  ? msg.content.split(" ").map((word, i) => {
                      const clean = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
                      return (
                        <span
                          key={i}
                          onClick={() => setSelectedWord(clean)}
                          className="cursor-pointer hover:bg-primary/20 hover:text-primary rounded px-0.5 transition-colors duration-200"
                        >
                          {word}{" "}
                        </span>
                      );
                    })
                  : msg.content}
              </div>
            </motion.div>
          ))}
          {/* Invisible padding for bottom scroll */}
          <div className="h-4" /> 
        </div>

        {/* Controls Area */}
        <div className="bg-card border border-border rounded-3xl p-2 shadow-lg flex items-center gap-2">
          {/* Text Input */}
          <form onSubmit={handleTextInput} className="flex-1 flex items-center bg-secondary/30 rounded-2xl px-3 border border-transparent focus-within:border-primary/30 transition-colors">
            <input 
              type="text" 
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="What do you do?"
              className="flex-1 bg-transparent py-3 outline-none text-sm placeholder:text-muted-foreground"
            />
            {textInput && (
              <button type="submit" className="text-primary hover:text-primary/80 transition-colors">
                <Send className="w-5 h-5" />
              </button>
            )}
          </form>

          {/* Voice Input Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleVoiceInput}
            className={`
              w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-all
              ${recorder.state === "recording" 
                ? 'bg-red-500 text-white shadow-red-500/30' 
                : 'bg-primary text-white shadow-primary/30 hover:bg-primary/90'}
            `}
          >
            {recorder.state === "recording" ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </motion.button>
        </div>
      </div>
      {/* Word popup reused from Read-style behavior */}
      <AdventureWordModal
        selectedWord={selectedWord}
        onClose={() => setSelectedWord(null)}
        vocabWords={vocabWords as any[] | undefined}
        lists={lists}
        createList={createList}
        addWordToList={addWordToList}
        selectedListId={selectedListId}
        setSelectedListId={setSelectedListId}
        onOpenCreateDialog={() => setShowCreateDialog(true)}
      />
      <CreateVocabListDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={async (name) => {
          if (!selectedWord) return;
          const clean = selectedWord.toLowerCase();
          const matchingWord = (vocabWords as any[] | undefined)?.find(
            (w) => w.term.toLowerCase() === clean
          );
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

interface AdventureWordModalProps {
  selectedWord: string | null;
  onClose: () => void;
  vocabWords?: any[];
  lists?: { vocabListId: number; name: string }[];
  createList: ReturnType<typeof useCreateVocabList>;
  addWordToList: ReturnType<typeof useAddWordToVocabList>;
  selectedListId: number | "";
  setSelectedListId: (v: number | "") => void;
  onOpenCreateDialog: () => void;
}

function AdventureWordModal({
  selectedWord,
  onClose,
  vocabWords,
  lists,
  createList,
  addWordToList,
  selectedListId,
  setSelectedListId,
  onOpenCreateDialog,
}: AdventureWordModalProps) {
  if (!selectedWord) return null;

  const clean = selectedWord.toLowerCase();
  const matchingWord = vocabWords?.find((w) => w.term.toLowerCase() === clean) || null;

  return (
    <AnimatePresence>
      {selectedWord && (
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
            className="fixed bottom-24 left-0 right-0 p-4 z-50 flex justify-center pointer-events-none"
          >
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-border/50 p-6 pointer-events-auto relative max-h-[80vh] overflow-y-auto pb-8">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>

              <div className="flex items-start gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold font-display capitalize mb-1">{selectedWord}</h3>
                </div>
                <AudioPlayer text={selectedWord} className="bg-primary/10 text-primary w-12 h-12" />
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Definition
                  </h4>
                  <p className="text-foreground/90">
                    In a full version, this definition would come from the main vocab data.
                  </p>
                </div>
              </div>

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
                  onClick={onOpenCreateDialog}
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
  );
}

