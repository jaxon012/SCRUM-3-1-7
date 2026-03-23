import { Layout } from "@/components/Layout";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  FlameIcon,
  TrophyIcon,
  CalendarIcon,
  StarIcon,
} from "@/components/icons";
import { useWords } from "@/hooks/use-words";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useMemo } from "react";

export default function Home() {
  const { data: streakData } = useQuery<{ streakCount: number }>({
    queryKey: ["/api/streak"],
    queryFn: () => fetch("/api/streak").then((r) => r.json()),
  });
  const [, navigate] = useLocation();
  const { data: words } = useWords();
  const streakCount = streakData?.streakCount ?? 0;
  const streakPct = Math.round((streakCount / 7) * 100);

  const featuredWord = useMemo(() => {
    if (!Array.isArray(words) || words.length === 0) return null;
    // Prefer a "new" word for the day; fall back to the first word.
    return (
      (words as any[]).find((w) => w?.userWordProgress?.status === "new") ??
      (words as any[])[0]
    );
  }, [words]);

  return (
    <Layout>
      <div className="grid gap-6 md:grid-cols-10">
        {/* Left (70%) */}
        <div className="md:col-span-7">
          {/* Featured Adventure */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Continue Journey</h3>
              <Link
                href="/adventure"
                className="text-sm text-foreground/80 font-medium hover:underline"
              >
                View All
              </Link>
            </div>

            <Link href="/adventure">
              <div className="cursor-pointer active:scale-[0.99] hover:scale-[1.01] transition-transform">
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-md group relative">
                  <div className="h-44 relative overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=75&fm=webp"
                      alt="A mystical temple scene from the adventure story"
                      width={800}
                      height={176}
                      fetchpriority="high"
                      loading="eager"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-medium text-white border border-white/10">
                      Level 3
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg text-foreground">The Lost Temple</h3>
                        <p className="text-sm text-muted-foreground">Interactive Story</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                        <ArrowRightIcon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 mt-3">
                      <div className="bg-primary h-1.5 rounded-full w-[35%]" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </section>

          {/* Quick Actions Grid */}
          <section className="grid grid-cols-2 gap-4">
            <Link href="/vocab">
              <div className="cursor-pointer group active:scale-[0.98] hover:scale-[1.02] transition-transform">
                <div className="bg-card hover:bg-card/80 border border-border/50 rounded-2xl p-5 shadow-sm transition-all h-full flex flex-col justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#B8A832]/20 text-[#6b5c10] flex items-center justify-center mb-4 group-hover:bg-[#B8A832]/40 group-hover:text-[#6b5c10] transition-colors">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Daily Vocab</h3>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/read">
              <div className="cursor-pointer group active:scale-[0.98] hover:scale-[1.02] transition-transform">
                <div className="bg-card hover:bg-card/80 border border-border/50 rounded-2xl p-5 shadow-sm transition-all h-full flex flex-col justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#6B9E78]/20 text-[#2d5c3a] flex items-center justify-center mb-4 group-hover:bg-[#6B9E78]/40 group-hover:text-[#2d5c3a] transition-colors">
                    <StarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Practice</h3>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        </div>

        {/* Right (30%) */}
        <div className="hidden md:block md:col-span-3 pt-[2.75rem]">
          <section className="md:sticky md:top-[110px] self-start space-y-4">
            {/* Streak Card */}
            <div className="bg-gradient-to-br from-primary to-accent rounded-3xl p-6 text-white shadow-lg shadow-primary/25 relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-white/80 text-base font-medium mb-1">Weekly Streak</p>
                  <h2 className="text-4xl leading-none font-display font-bold">
                    {streakCount}/7 Days
                  </h2>
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
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${streakPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Featured Word */}
            <div className="rounded-3xl p-6 border border-border/50 shadow-sm bg-gradient-to-br from-[#C97B4B]/15 via-[#B8A832]/10 to-secondary/30">
              <div className="flex items-center justify-between mb-3 gap-3">
                <span className="inline-flex items-center rounded-full bg-background/60 border border-border/60 px-3 py-1 text-xs font-bold text-foreground">
                  NEW TODAY
                </span>
                <span className="text-xs text-muted-foreground hidden lg:block">Practice with voice</span>
              </div>

              <h3 className="text-2xl font-bold text-foreground mb-2">
                {featuredWord?.term ?? "—"}
              </h3>

              <div className="flex items-center gap-3 mb-5">
                <span className="text-sm text-muted-foreground italic">
                  {featuredWord?.phonetic ?? ""}
                </span>
                {featuredWord?.term && (
                  <AudioPlayer text={featuredWord.term} className="p-1 w-9 h-9" />
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Meaning
                  </p>
                  <p className="text-sm text-foreground/90">
                    {featuredWord?.definition ?? "Pick a new word and practice it today."}
                  </p>
                </div>

                <div className="bg-background/50 rounded-2xl border border-border/40 p-4">
                  <p className="text-sm italic text-muted-foreground">
                    {"\""}
                    {featuredWord?.term
                      ? `${featuredWord.term.charAt(0).toUpperCase()}${featuredWord.term.slice(
                          1
                        )}`
                      : "This word"}
                    {"\""} is today’s featured word. Try saying it out loud and using it in a quick sentence you’d actually say.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!featuredWord?.term}
                  onClick={() => {
                    if (!featuredWord?.term) return;
                    localStorage.setItem(
                      "lingoquest_featured_word",
                      featuredWord.term
                    );
                    navigate("/vocab");
                  }}
                  className="w-full mt-2 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Practice this word
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
