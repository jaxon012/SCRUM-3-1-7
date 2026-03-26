import { Layout } from "@/components/Layout";
import { ME_QUERY_KEY } from "@/hooks/use-me";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";

interface AdminUser {
  userId: number;
  username: string;
  displayName: string;
  email: string;
  password: string;
  passwordPlain: string | null;
  role: string;
  createdAt: string;
}

export default function Admin() {
  const [, navigate] = useLocation();

  const { data: currentUser } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetch("/api/me", { credentials: "include" }).then(r => r.json()),
  });

  const { data: users, isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    enabled: !!currentUser && currentUser.role === "admin",
  });

  if (currentUser && currentUser.role !== "admin") {
    navigate("/");
    return null;
  }

  return (
    <Layout title="All Accounts" showBack>
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading users...</p>}
        {error && <p className="text-sm text-red-500">Access denied or error loading users.</p>}

        {users && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{users.length} registered account{users.length !== 1 ? "s" : ""}</p>

            <div className="rounded-xl border border-border/50 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-2 py-2 font-medium w-8">ID</th>
                    <th className="px-2 py-2 font-medium">User</th>
                    <th className="px-2 py-2 font-medium">Password (hashed)</th>
                    <th className="px-2 py-2 font-medium w-12 text-center">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <UserRow key={u.userId} user={u} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-center pt-6">
          <img
            src="/superadmin.png"
            alt="Super Admin"
            className="max-w-[280px] w-full"
          />
        </div>
      </div>
    </Layout>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const [showPlain, setShowPlain] = useState(false);

  // Truncate hash shorter so it fits the mobile layout
  const displayHash = user.password.startsWith("$2b$")
    ? user.password.substring(0, 12) + "..."
    : user.password;

  return (
    <tr className="border-t border-border/30 hover:bg-muted/20">
      <td className="px-2 py-2 text-muted-foreground">{user.userId}</td>
      <td className="px-2 py-2">
        <div className="font-semibold leading-tight">{user.username}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{user.displayName}</div>
      </td>
      <td
        className="px-2 py-2 font-mono text-[10px] cursor-help max-w-[120px]"
        onMouseEnter={() => setShowPlain(true)}
        onMouseLeave={() => setShowPlain(false)}
      >
        {showPlain && user.passwordPlain ? (
          <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-semibold text-xs">
            {user.passwordPlain}
          </span>
        ) : (
          <span className="text-muted-foreground break-all" title="Hover to reveal password">
            {displayHash}
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
          user.role === "admin"
            ? "bg-amber-100 text-amber-800"
            : "bg-primary/10 text-primary"
        }`}>
          {user.role}
        </span>
      </td>
    </tr>
  );
}
