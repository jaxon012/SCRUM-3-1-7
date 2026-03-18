import { Layout } from "@/components/Layout";

export default function Signup() {
  return (
    <Layout title="Create Account" showBack>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Create an account to save your progress.
        </p>

        <div className="space-y-2">
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Username"
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            type="password"
            placeholder="Password"
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            type="password"
            placeholder="Confirm password"
          />
        </div>

        <button
          className="w-full py-2 px-4 bg-primary text-white rounded-lg text-sm hover:opacity-90"
          type="button"
        >
          Create Account
        </button>
      </div>
    </Layout>
  );
}

