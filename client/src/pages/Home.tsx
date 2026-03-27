import { Layout } from "@/components/Layout";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CalendarIcon,
  StarIcon,
} from "@/components/icons";
import { useWords } from "@/hooks/use-words";
import { useMemo } from "react";
import { useMe } from "@/hooks/use-me";
import {
  FeaturedWordCard,
  StreakCard,
  type FeaturedWord,
} from "@/components/HomeProgressCards";

export default function Home() {
  const { data: me } = useMe();
  const userId = me?.userId;

  const { data: streakData } = useQuery<{ streakCount: number }>({
    queryKey: ["/api/streak", userId],
    enabled: !!userId,
    queryFn: () =>
      fetch("/api/streak", { credentials: "include" }).then((r) => r.json()),
  });
  const [, navigate] = useLocation();
  const { data: words } = useWords();
  const streakCount = streakData?.streakCount ?? 0;
  const streakPct = Math.round((streakCount / 7) * 100);

  const featuredWord = useMemo(() => {
    if (!Array.isArray(words) || words.length === 0) return null;
    // Prefer a "new" word for the day; fall back to the first word.
    return (
      (words as FeaturedWord[]).find((w) => w?.userWordProgress?.status === "new") ??
      (words as FeaturedWord[])[0]
    );
  }, [words]);

  const handlePracticeWord = () => {
    if (!featuredWord?.term) return;
    localStorage.setItem("lingoquest_featured_word", featuredWord.term);
    navigate("/vocab");
  };

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
                      src="/adventure-hero.png"
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

          {/* Mobile Progress + Featured Word */}
          <section className="mt-6 space-y-4 md:hidden">
            <StreakCard streakCount={streakCount} streakPct={streakPct} />
            <FeaturedWordCard
              featuredWord={featuredWord}
              onPracticeWord={handlePracticeWord}
              hidePracticeLabelOnLg={false}
            />
          </section>
        </div>

        {/* Right (30%) */}
        <div className="hidden md:block md:col-span-3 pt-[2.75rem]">
          <section className="md:sticky md:top-[110px] self-start space-y-4">
            <StreakCard streakCount={streakCount} streakPct={streakPct} />
            <FeaturedWordCard
              featuredWord={featuredWord}
              onPracticeWord={handlePracticeWord}
              hidePracticeLabelOnLg={true}
            />
          </section>
        </div>
      </div>
    </Layout>
  );
}
