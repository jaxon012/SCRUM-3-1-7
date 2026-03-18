import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export interface VocabListSummary {
  vocabListId: number;
  name: string;
  createdAt: string | Date;
  wordCount?: number;
}

export function useVocabLists() {
  return useQuery<VocabListSummary[]>({
    queryKey: [api.vocabLists.list.path],
    queryFn: async () => {
      const res = await fetch(api.vocabLists.list.path, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to fetch vocab lists");
      }
      return await res.json();
    },
  });
}

export function useCreateVocabList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(api.vocabLists.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to create vocab list");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vocabLists.list.path] });
    },
  });
}

export function useVocabListWords(listId?: number) {
  return useQuery({
    queryKey: [api.vocabLists.words.list.path, listId],
    enabled: !!listId,
    queryFn: async () => {
      if (!listId) return [];
      const url = buildUrl(api.vocabLists.words.list.path, { listId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to fetch vocab list words");
      }
      return await res.json();
    },
  });
}

export function useAddWordToVocabList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { listId: number; wordId?: number; term?: string }) => {
      if (params.wordId !== undefined) {
        const url = buildUrl(api.vocabLists.words.add.path, {
          listId: params.listId,
        });
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ wordId: params.wordId }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || "Failed to add word to list");
        }
        return await res.json();
      } else if (params.term) {
        const url = buildUrl(api.vocabLists.words.addFromTerm.path, {
          listId: params.listId,
        });
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ term: params.term }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || "Failed to add word to list from term");
        }
        return await res.json();
      } else {
        throw new Error("Either wordId or term must be provided");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.vocabLists.list.path],
      });
      queryClient.invalidateQueries({
        queryKey: [api.vocabLists.words.list.path, variables.listId],
      });
    },
  });
}

