const SORT_PREFS_KEY = "lingoquest_sort_prefs";

/** List IDs in prefs are per-user; clear on auth change to avoid cross-account bleed in filters. */
export function clearVocabSortPrefsFromStorage(): void {
  try {
    localStorage.removeItem(SORT_PREFS_KEY);
  } catch {
    /* ignore */
  }
}
