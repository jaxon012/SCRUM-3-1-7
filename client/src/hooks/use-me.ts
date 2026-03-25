import { useQuery, type QueryClient } from "@tanstack/react-query";

export type MeUser = {
  userId: number;
  displayName: string;
  username: string;
  role: string;
};

export const ME_QUERY_KEY = ["me"] as const;

/**
 * Shared session query — must match queryKey ["me"] everywhere so React Query dedupes.
 */
export function useMe() {
  return useQuery<MeUser | null>({
    queryKey: ME_QUERY_KEY,
    queryFn: () =>
      fetch("/api/me", { credentials: "include" }).then((r) => r.json()),
  });
}

/** Use in mutation callbacks so invalidations stay scoped to the logged-in user. */
export function getCachedMeUserId(queryClient: QueryClient): number | undefined {
  const me = queryClient.getQueryData<MeUser | null>(ME_QUERY_KEY);
  return me?.userId;
}
