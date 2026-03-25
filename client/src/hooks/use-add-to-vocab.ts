import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { getCachedMeUserId } from "@/hooks/use-me";

export function useAddWordToVocab() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (term: string) => {
      const res = await fetch(api.addToVocab.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ term }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to add word to vocab");
      }
      return res.json();
    },
    onSuccess: () => {
      const uid = getCachedMeUserId(queryClient);
      if (uid != null) {
        void queryClient.invalidateQueries({
          queryKey: [api.words.list.path, uid],
        });
      }
    },
  });
}
