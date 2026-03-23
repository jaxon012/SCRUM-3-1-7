import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading } = useQuery({
    queryKey: ["me"],
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
      queryClient.invalidateQueries({ queryKey: ["me"] });
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
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center max-w-4xl mx-auto">
        {/* Welcome copy */}
        <div className="space-y-5 order-2 md:order-1">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Welcome to LingoQuest
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              A gamified language learning platform that makes vocabulary and reading practice
              engaging and fun. Build daily streaks, master new words with flashcards, and
              dive into interactive adventures with AI-powered voice practice.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">•</span>
              Daily vocabulary challenges
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">•</span>
              Reading comprehension exercises
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">•</span>
              Text-based adventure with voice interaction
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">•</span>
              Track your progress and streaks
            </li>
          </ul>
        </div>

        {/* Login form card */}
        <div className="order-1 md:order-2">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-1">Sign in</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to continue learning.
            </p>

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
                className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <button
              onClick={() => loginMutation.mutate()}
              disabled={loginMutation.isPending}
              className="w-full mt-4 py-2.5 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
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
