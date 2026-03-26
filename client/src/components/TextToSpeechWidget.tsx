import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, Square } from "lucide-react";

function SpeakerPlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 13.5v9h6l7.5 7.5V6L10 13.5H4z" fill="white" />
      <path
        d="M22 18c0-2.21-1.27-4.1-3.13-5.03v10.05C20.73 22.1 22 20.21 22 18z"
        fill="white"
        opacity="0.9"
      />
      <path
        d="M25.5 18c0-4.41-2.55-8.23-6.25-10.06v2.52C21.98 12 23.5 14.81 23.5 18s-1.52 6-4.25 7.54v2.52C23 26.23 25.5 22.41 25.5 18z"
        fill="white"
        opacity="0.7"
      />
      <circle cx="11" cy="11" r="7" fill="white" opacity="0.25" />
      <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="1.5" />
      <path d="M9 8.5l5 2.5-5 2.5V8.5z" fill="white" />
    </svg>
  );
}

export function TextToSpeechWidget() {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const speak = useCallback((text: string) => {
    if (!text.trim() || !supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const handleSelectionEnd = useCallback(() => {
    if (!isActive) return;
    setTimeout(() => {
      const selected = window.getSelection()?.toString().trim();
      if (selected) speak(selected);
    }, 100);
  }, [isActive, speak]);

  useEffect(() => {
    if (isActive) {
      document.addEventListener("mouseup", handleSelectionEnd);
      document.addEventListener("touchend", handleSelectionEnd);
    }
    return () => {
      document.removeEventListener("mouseup", handleSelectionEnd);
      document.removeEventListener("touchend", handleSelectionEnd);
    };
  }, [isActive, handleSelectionEnd]);

  useEffect(() => {
    if (isActive) {
      document.body.classList.add("tts-reading-mode");
    } else {
      document.body.classList.remove("tts-reading-mode");
    }
    return () => {
      document.body.classList.remove("tts-reading-mode");
    };
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const toggleActive = () => {
    if (isActive) {
      if (supported) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
    setIsActive((prev) => !prev);
  };

  const handlePauseResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supported) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (supported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setIsActive(false);
  };

  if (!supported) return null;

  return (
    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-6 z-[60] flex flex-col items-end gap-2 select-none">

      {isSpeaking && (
        <div className="flex gap-2 animate-fade-in">
          <button
            onClick={handlePauseResume}
            aria-label={isPaused ? "Resume reading" : "Pause reading"}
            className="tts-control-btn"
          >
            {isPaused ? (
              <Play className="w-4 h-4 text-purple-600" fill="currentColor" />
            ) : (
              <Pause className="w-4 h-4 text-purple-600" fill="currentColor" />
            )}
          </button>
          <button
            onClick={handleStop}
            aria-label="Stop reading"
            className="tts-control-btn"
          >
            <Square className="w-4 h-4 text-red-500" fill="currentColor" />
          </button>
        </div>
      )}

      {isActive && !isSpeaking && (
        <div className="tts-hint animate-fade-in">
          Tap &amp; drag to read text aloud
        </div>
      )}

      <button
        onClick={toggleActive}
        aria-label={isActive ? "Turn off read aloud" : "Turn on read aloud"}
        aria-pressed={isActive}
        className={`tts-main-btn ${isActive ? "tts-main-btn--active" : "tts-main-btn--idle"}`}
      >
        <SpeakerPlayIcon className="w-8 h-8" />
      </button>
    </div>
  );
}
