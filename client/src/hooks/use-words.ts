import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useMe } from "@/hooks/use-me";

export function useWords() {
  const { data: me } = useMe();
  const userId = me?.userId;

  return useQuery({
    queryKey: [api.words.list.path, userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch("/api/words", { credentials: "include" });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to fetch words");
      }
      const data = await res.json();
      const parsed = api.words.list.responses[200].safeParse(data);
      if (!parsed.success) {
        console.error("Words API parse error:", parsed.error);
        return Array.isArray(data) ? data : [];
      }
      return parsed.data;
    },
  });
}

export function useWordLookup(term: string | null) {
  return useQuery({
    queryKey: ["/api/word-lookup", term?.toLowerCase()],
    queryFn: async () => {
      if (!term) return null;
      const res = await fetch(
        `/api/word-lookup/${encodeURIComponent(term.toLowerCase())}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      return res.json() as Promise<{
        wordId: number;
        term: string;
        definition: string;
        phonetic: string | null;
        audioUrl: string | null;
        imageUrl: string | null;
      }>;
    },
    enabled: !!term && term.trim().length > 0,
    staleTime: 1000 * 60 * 60,
  });
}
