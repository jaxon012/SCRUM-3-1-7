import { useMutation, useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useReadingPassages() {
  return useQuery({
    queryKey: [api.readingPassages.list.path],
    queryFn: async () => {
      const res = await fetch(api.readingPassages.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reading passages");
      return api.readingPassages.list.responses[200].parse(await res.json());
    },
  });
}

export function useReadingPassage(id: number) {
  return useQuery({
    queryKey: [api.readingPassages.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.readingPassages.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch passage");
      return api.readingPassages.get.responses[200].parse(await res.json());
    },
  });
}

export function useCurrentReadingProgress() {
  return useQuery({
    queryKey: ["/api/reading-progress/current"],
    queryFn: async () => {
      const res = await fetch("/api/reading-progress/current", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.passageId as number) ?? null;
    },
  });
}

export function useSaveReadingProgress() {
  return useMutation({
    mutationFn: async (passageId: number) => {
      await fetch("/api/reading-progress", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passageId }),
      });
    },
  });
}
