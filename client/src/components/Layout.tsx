import { Link, useLocation } from "wouter";
import { Home, BookOpen, Mic, Gamepad2, ChevronLeft, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export function Layout({ children, title, showBack = false }: LayoutProps) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetch("/api/me", { credentials: "include" }).then(r => r.json()),
  });

  const loginMutation = useMutation({
    mutationFn: () => fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    }).then(async r => {
      if (!r.ok) throw new Error("Invalid credentials");
      return r.json();
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setUsername("");
      setPassword("");
      setError("");
    },
    onError: () => setError("Invalid username or password"),
  });

  const logoutMutation = useMutation({
    mutationFn: () => fetch("/api/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-border/40 relative">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3">
          {showBack && (
            <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-6 h-6" />
            </Link>
          )}
          {title ? (
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              {title}
            </h1>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                L
              </div>
              <span className="font-display font-bold text-xl">LingoQuest</span>
            </Link>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-full hover:bg-secondary transition-colors">
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-lg border border-border/50 p-4 z-50">
              {currentUser ? (
                <div>
                  <p className="text-sm font-medium mb-2">Logged in as <strong>{currentUser.displayName}</strong></p>
                  <button onClick={() => { logoutMutation.mutate(); setMenuOpen(false); }}
                    className="w-full py-2 px-4 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
                    Log Out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Log In</p>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username"
                    className="border rounded-lg px-3 py-2 text-sm" />
                  <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
                    className="border rounded-lg px-3 py-2 text-sm" />
                  <button onClick={() => loginMutation.mutate()}
                    className="w-full py-2 px-4 bg-primary text-white rounded-lg text-sm hover:opacity-90">
                    Log In
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 pb-24 overflow-y-auto scrollbar-hide">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-lg border-t border-border/50 px-6 py-4 z-50">
        <div className="flex justify-between items-center">
          <NavLink href="/" icon={Home} label="Home" active={location === "/"} />
          <NavLink href="/vocab" icon={BookOpen} label="Vocab" active={location === "/vocab"} />
          <NavLink href="/read" icon={Mic} label="Read" active={location === "/read"} />
          <NavLink href="/adventure" icon={Gamepad2} label="Play" active={location === "/adventure"} />
        </div>
      </nav>
    </div>
  );
}

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 group w-16">
      <div className={`
        p-2.5 rounded-2xl transition-all duration-300 relative
        ${active ? 'text-primary bg-primary/10 scale-110 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}
      `}>
        <Icon className={`w-6 h-6 ${active ? 'fill-current' : ''}`} strokeWidth={active ? 2.5 : 2} />
        {active && (
          <motion.div
            layoutId="nav-pill"
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
          />
        )}
      </div>
      <span className={`text-[10px] font-medium transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </Link>
  );
}
