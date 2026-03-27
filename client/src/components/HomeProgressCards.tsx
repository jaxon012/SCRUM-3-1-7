import { FlameIcon } from "@/components/icons";
import { AudioPlayer } from "@/components/AudioPlayer";

export type FeaturedWord = {
  term?: string;
  phonetic?: string;
  definition?: string;
  userWordProgress?: { status?: string };
};

export function StreakCard({
  streakCount,
  streakPct,
}: {
  streakCount: number;
  streakPct: number;
}) {
  return (
    <div className="bg-gradient-to-br from-primary to-accent rounded-3xl p-6 text-white shadow-lg shadow-primary/25 relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-white/80 text-base font-medium mb-1">Weekly Streak</p>
          <h2 className="text-4xl leading-none font-display font-bold">{streakCount}/7 Days</h2>
        </div>
        <div className="bg-white/20 p-3 rounded-2xl">
          <FlameIcon className="w-8 h-8 text-orange-300 fill-orange-300" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium text-white/70">
          <span>Keep going!</span>
          <span>{streakPct}%</span>
        </div>
        <div className="h-3 bg-black/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: `${streakPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function FeaturedWordCard({
  featuredWord,
  onPracticeWord,
  hidePracticeLabelOnLg,
}: {
  featuredWord: FeaturedWord | null;
  onPracticeWord: () => void;
  hidePracticeLabelOnLg: boolean;
}) {
  return (
    <div className="rounded-3xl p-6 border border-border/50 shadow-sm bg-gradient-to-br from-[#C97B4B]/15 via-[#B8A832]/10 to-secondary/30">
      <div className="flex items-center justify-between mb-3 gap-3">
        <span className="inline-flex items-center rounded-full bg-background/60 border border-border/60 px-3 py-1 text-xs font-bold text-foreground">
          NEW TODAY
        </span>
        <span className={`text-xs text-muted-foreground ${hidePracticeLabelOnLg ? "hidden lg:block" : ""}`}>
          Practice with voice
        </span>
      </div>

      <h3 className="text-2xl font-bold text-foreground mb-2">{featuredWord?.term ?? "—"}</h3>

      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm text-muted-foreground italic">{featuredWord?.phonetic ?? ""}</span>
        {featuredWord?.term && <AudioPlayer text={featuredWord.term} className="p-1 w-9 h-9" />}
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Meaning</p>
          <p className="text-sm text-foreground/90">
            {featuredWord?.definition ?? "Pick a new word and practice it today."}
          </p>
        </div>

        <div className="bg-background/50 rounded-2xl border border-border/40 p-4">
          <p className="text-sm italic text-muted-foreground">
            {"\""}
            {featuredWord?.term
              ? `${featuredWord.term.charAt(0).toUpperCase()}${featuredWord.term.slice(1)}`
              : "This word"}
            {"\""} is today’s featured word. Try saying it out loud and using it in a quick sentence you’d
            actually say.
          </p>
        </div>

        <button
          type="button"
          disabled={!featuredWord?.term}
          onClick={onPracticeWord}
          className="w-full mt-2 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Practice this word
        </button>
      </div>
    </div>
  );
}
