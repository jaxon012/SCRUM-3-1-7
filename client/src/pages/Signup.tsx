import { Layout } from "@/components/Layout";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ME_QUERY_KEY } from "@/hooks/use-me";
import { clearVocabSortPrefsFromStorage } from "@/lib/vocab-prefs-storage";
import { useLocation } from "wouter";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const signupMutation = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, email, displayName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Signup failed");
      }
      return res.json();
    },
    onSuccess: () => {
      clearVocabSortPrefsFromStorage();
      queryClient.clear();
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      navigate("/");
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Layout showBack backOnly>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
        <p className="text-sm text-muted-foreground">
          Create an account to save your progress.
        </p>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="space-y-2">
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Display Name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          className="w-full py-2 px-4 bg-primary text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          type="button"
          disabled={signupMutation.isPending}
          onClick={() => signupMutation.mutate()}
        >
          {signupMutation.isPending ? "Creating..." : "Create Account"}
        </button>
      </div>
    </Layout>
  );
}
