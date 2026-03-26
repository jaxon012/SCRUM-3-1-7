import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ME_QUERY_KEY } from "@/hooks/use-me";
import { clearVocabSortPrefsFromStorage } from "@/lib/vocab-prefs-storage";
import { useLocation } from "wouter";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetch("/api/me", { credentials: "include" }).then((r) => r.json()),
  });

  useEffect(() => {
    if (!isLoading && currentUser) {
      navigate("/");
    }
  }, [isLoading, currentUser, navigate]);

  const loginMutation = useMutation({
    mutationFn: () =>
      fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      }).then(async (r) => {
        if (!r.ok) throw new Error("Invalid credentials");
        return r.json();
      }),
    onSuccess: () => {
      clearVocabSortPrefsFromStorage();
      queryClient.clear();
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      setUsername("");
      setPassword("");
      setError("");
      navigate("/");
    },
    onError: () => setError("Invalid username or password"),
  });

  if (!isLoading && currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 px-4 py-10 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center max-w-5xl mx-auto">
          {/* Welcome copy */}
          <div className="space-y-5 order-1 md:order-1">
            <div className="flex justify-center">
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
                  LingoQuest
                </h2>
              </div>
            </div>

            <div className="flex justify-center">
              <img
                src="/login-mascot-tan.png"
                alt="LingoQuest mascot"
                className="w-52 h-52 object-contain rounded-lg border border-border/50"
                loading="eager"
              />
            </div>

            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Learn a little every day.
              </h2>
              <p className="mt-3 text-muted-foreground max-w-md mx-auto">
                Build your vocabulary, practice reading, and keep your streak going.
              </p>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground text-center transform translate-x-4">
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                Daily words
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                Reading practice
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                Weekly streaks
              </li>
            </ul>
          </div>

          {/* Login form card */}
          <div className="order-2 md:order-2">
            <div className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-xl backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-foreground mb-1">Welcome back</h3>
              <p className="text-sm text-muted-foreground mb-4">Sign in to continue.</p>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg mb-4">
                  {error}
                </p>
              )}

              <div className="space-y-3">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 text-sm"
                />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type="password"
                  className="w-full border border-border bg-background text-foreground rounded-xl px-3 py-2.5 text-sm"
                />
              </div>

              <button
                onClick={() => loginMutation.mutate()}
                disabled={loginMutation.isPending}
                className="w-full mt-4 py-2.5 px-4 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loginMutation.isPending ? "Signing in..." : "Log In"}
              </button>

              <p className="text-center text-sm text-muted-foreground mt-4">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary font-medium hover:underline">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
