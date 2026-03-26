import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { getCachedMeUserId } from "@/hooks/use-me";

interface UpdateWordProgressRequest {
  userWordId: number;
}

export function useUpdateWordProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userWordId }: UpdateWordProgressRequest) => {
      const url = buildUrl(api.wordProgress.update.path, { userWordId });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Word progress update failed:", errorText);
        throw new Error("Failed to update word progress");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      const uid = getCachedMeUserId(queryClient);
      if (uid != null) {
        void queryClient.invalidateQueries({
          queryKey: [api.words.list.path, uid],
        });

        // In vocab-list mode, the UI reads from /api/vocab-lists/:listId/words,
        // so invalidate all vocab-list word queries for this user.
        void queryClient.invalidateQueries({
          queryKey: [api.vocabLists.words.list.path],
        });
      }
    },
    onError: (error) => {
      console.error("Mutation error:", error);
    },
  });
}

export function useMarkWordAsMasteredByWordId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wordId }: { wordId: number }) => {
      const res = await fetch(`/api/word-progress/mark-mastered/${wordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Mark-as-mastered failed:", errorText);
        throw new Error("Failed to mark word as mastered");
      }

      return await res.json();
    },
    onSuccess: () => {
      const uid = getCachedMeUserId(queryClient);
      if (uid != null) {
        void queryClient.invalidateQueries({
          queryKey: [api.words.list.path, uid],
        });
        void queryClient.invalidateQueries({
          queryKey: [api.vocabLists.words.list.path],
        });
      }
    },
  });
}
