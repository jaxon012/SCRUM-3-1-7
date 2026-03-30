import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, X, RotateCcw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useWords, useWordLookup } from "@/hooks/use-words";
import {
  useVocabLists,
  useCreateVocabList,
  useAddWordToVocabList,
} from "@/hooks/use-vocab-lists";
import { useAddWordToVocab } from "@/hooks/use-add-to-vocab";
import { AudioPlayer } from "@/components/AudioPlayer";
import { CreateVocabListDialog } from "@/components/CreateVocabListDialog";

const MAX_TURNS = 5;

const DEFAULT_ADVENTURE_SCENE_IMAGE = "/adventure-hero.webp";

/** Turn the latest narrator text into a visual prompt for the image API. */
function buildSceneImagePrompt(storyBeat: string): string {
  const excerpt = storyBeat.replace(/\s+/g, " ").trim().slice(0, 900);
  return (
    "Fantasy adventure scene, painterly illustration, cinematic lighting, rich color, " +
    "no text or letters in the image. Show this moment: " +
    excerpt
  );
}

async function requestSceneImage(
  prompt: string
): Promise<{ url: string | null; error?: string }> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ prompt, size: "512x512" }),
  });
  if (!res.ok) {
    let message = `Image request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* not JSON */
    }
    console.warn("generate-image failed:", res.status, message);
    return { url: null, error: message };
  }
  const data = (await res.json()) as { url?: string | null; b64_json?: string | null };
  if (data.url) return { url: data.url };
  if (data.b64_json) return { url: `data:image/png;base64,${data.b64_json}` };
  return { url: null, error: "No image data in response" };
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export default function Adventure() {
  const { data: vocabWords } = useWords();
  const { data: lists } = useVocabLists();
  const createList = useCreateVocabList();
  const addWordToList = useAddWordToVocabList();
  const addWordToVocab = useAddWordToVocab();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<number | "">("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome, brave adventurer! You stand at the gates of an ancient castle, its towering walls covered in ivy and mystery. A faint glow shines from within, and you hear distant echoes of a forgotten language. Do you enter through the main gate, or search for a hidden passage along the castle walls?",
    },
  ]);
  const [textInput, setTextInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [sceneImageUrl, setSceneImageUrl] = useState(DEFAULT_ADVENTURE_SCENE_IMAGE);
  const [sceneImageLoading, setSceneImageLoading] = useState(false);
  const [sceneImageError, setSceneImageError] = useState<string | null>(null);
  const [adventureError, setAdventureError] = useState<string | null>(null);
  const sceneImageRequestId = useRef(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleTextInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isStreaming || isComplete) return;

    setAdventureError(null);
    setSceneImageError(null);
    const content = textInput;
    const prevMessages = messages;
    const prevTurn = turnCount;
    const newTurnNumber = turnCount + 1;
    const updatedMessages = [...messages, { role: "user" as const, content }];
    setTextInput("");
    setMessages(updatedMessages);
    setTurnCount(newTurnNumber);
    setIsStreaming(true);

    let assistantMessage = "";
    try {
      const res = await fetch("/api/adventure/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: updatedMessages, turnNumber: newTurnNumber }),
      });

      if (!res.ok) {
        let errMsg = `Adventure request failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) errMsg = body.error;
        } catch {
          /* not JSON */
        }
        console.error("Adventure API error:", res.status, errMsg);
        setAdventureError(errMsg);
        setMessages(prevMessages);
        setTurnCount(prevTurn);
        setTextInput(content);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setAdventureError("Adventure response had no body to read.");
        setMessages(prevMessages);
        setTurnCount(prevTurn);
        setTextInput(content);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "content" && data.content) {
                assistantMessage += data.content;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { role: "assistant", content: assistantMessage };
                  return newMsgs;
                });
              } else if (data.type === "done") {
                if (data.isComplete) {
                  setIsComplete(true);
                }
              }
            } catch {
              // Partial JSON, completed in next chunk
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setAdventureError("Could not reach the adventure server. Try again.");
      setMessages(prevMessages);
      setTurnCount(prevTurn);
      setTextInput(content);
    } finally {
      setIsStreaming(false);
    }

    if (assistantMessage.trim()) {
      const reqId = ++sceneImageRequestId.current;
      setSceneImageLoading(true);
      try {
        const prompt = buildSceneImagePrompt(assistantMessage);
        const { url, error: imgErr } = await requestSceneImage(prompt);
        if (reqId === sceneImageRequestId.current) {
          if (imgErr) setSceneImageError(imgErr);
          else if (url) {
            setSceneImageError(null);
            setSceneImageUrl(url);
          }
        }
      } catch (e) {
        console.error("Scene image error:", e);
      } finally {
        if (reqId === sceneImageRequestId.current) {
          setSceneImageLoading(false);
        }
      }
    }
  };

  const handleNewAdventure = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Welcome, brave adventurer! You stand at the gates of an ancient castle, its towering walls covered in ivy and mystery. A faint glow shines from within, and you hear distant echoes of a forgotten language. Do you enter through the main gate, or search for a hidden passage along the castle walls?",
      },
    ]);
    setTurnCount(0);
    setIsComplete(false);
    setTextInput("");
    sceneImageRequestId.current += 1;
    setSceneImageUrl(DEFAULT_ADVENTURE_SCENE_IMAGE);
    setSceneImageLoading(false);
    setAdventureError(null);
    setSceneImageError(null);
  };

  return (
    <Layout title="Adventure Mode" showBack>
      <div className="h-[calc(100vh-180px)] flex flex-col gap-3 min-h-0">
        {adventureError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {adventureError}
          </div>
        )}
        {/* Desktop: image left + story right; mobile: stacked */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-stretch">
          {/* Left: scene image (square, centered in column) */}
          <div className="flex flex-col justify-center items-center gap-2 min-h-0 py-1 md:py-0">
            <div className="relative w-full max-w-[min(100%,340px)] sm:max-w-[380px] md:max-w-[400px] aspect-square rounded-2xl overflow-hidden shadow-md border border-border bg-muted/40">
              <img
                src={sceneImageUrl}
                alt="Current scene"
                className="absolute inset-0 w-full h-full object-contain object-center p-1 transition-opacity duration-300"
              />
              {sceneImageLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] z-10"
                  aria-busy
                  aria-label="Generating scene image"
                >
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium text-white border border-white/10 z-20">
                Turn {turnCount}/{MAX_TURNS} {isComplete ? "— Story Complete" : ""}
              </div>
            </div>
            {sceneImageError && (
              <p
                role="status"
                className="text-xs text-muted-foreground text-center max-w-[min(100%,400px)] px-2 leading-snug"
              >
                {sceneImageError}
              </p>
            )}
          </div>

          {/* Right: AI conversation */}
          <div className="flex flex-col h-full min-h-[200px] md:min-h-0">
            <div
              className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4 min-h-0"
              ref={scrollRef}
            >
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`
                  max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed
                  ${msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-secondary/40 border border-border/50 text-foreground rounded-tl-none"}
                `}
                  >
                    {msg.role === "assistant"
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
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="bg-secondary/40 border border-border/50 rounded-2xl rounded-tl-none p-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div className="h-2" />
            </div>
          </div>
        </div>

        {/* Input Area — full width below both columns */}
        {isComplete ? (
          <div className="shrink-0 bg-card border border-border rounded-2xl p-3 shadow-sm flex items-center justify-center">
            <button
              onClick={handleNewAdventure}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Start New Adventure
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleTextInput}
            className="shrink-0 bg-card border border-border rounded-2xl p-2 shadow-sm flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="What do you do?"
              aria-label="Your action"
              disabled={isStreaming}
              className="flex-1 bg-secondary/30 rounded-xl px-3 py-2.5 outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50 border border-transparent focus:border-primary/30 transition-colors"
            />
            <button
              type="submit"
              aria-label={isStreaming ? "Sending…" : "Send"}
              disabled={!textInput.trim() || isStreaming}
              className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        )}
      </div>
      {/* Word popup */}
      <AdventureWordModal
        selectedWord={selectedWord}
        onClose={() => setSelectedWord(null)}
        vocabWords={vocabWords as any[] | undefined}
        lists={lists}
        createList={createList}
        addWordToList={addWordToList}
        addWordToVocab={addWordToVocab}
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
            (w) => w.term.toLowerCase() === clean,
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
  addWordToVocab: ReturnType<typeof useAddWordToVocab>;
  selectedListId: number | "";
  setSelectedListId: (v: number | "") => void;
  onOpenCreateDialog: () => void;
}

function AdventureWordModal({
  selectedWord,
  onClose,
  vocabWords,
  lists,
  addWordToList,
  addWordToVocab,
  selectedListId,
  setSelectedListId,
  onOpenCreateDialog,
}: AdventureWordModalProps) {
  const { data: lookedUpWord, isLoading: isLookingUp } = useWordLookup(selectedWord);

  const clean = selectedWord?.toLowerCase() ?? "";
  const matchingWord =
    lookedUpWord ||
    vocabWords?.find((w) => w.term.toLowerCase() === clean) ||
    null;

  if (!selectedWord) return null;

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
            className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none px-4 pb-24"
          >
            <div className="bg-card w-full max-w-lg md:max-w-xl rounded-3xl shadow-2xl border border-border/50 p-6 pointer-events-auto relative max-h-[80vh] overflow-y-auto pb-4">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>

              <div className="flex items-start gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold font-display capitalize mb-1">
                    {selectedWord}
                  </h3>
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

              <div className="mt-6 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Add to Vocab
                </p>
                <div className="space-y-2">
                  <select
                    value={selectedListId}
                    onChange={(e) =>
                      setSelectedListId(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
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
                    onClick={async () => {
                      if (!selectedWord) return;
                      try {
                        if (!selectedListId) {
                          await addWordToVocab.mutateAsync(selectedWord);
                        } else if (matchingWord) {
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
                    disabled={addWordToList.isPending || addWordToVocab.isPending}
                    className="w-full px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                  >
                    {addWordToList.isPending || addWordToVocab.isPending ? "Adding..." : "Add to Vocab"}
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
