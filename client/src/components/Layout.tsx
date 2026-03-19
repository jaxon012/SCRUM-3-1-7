import { Link, useLocation } from "wouter";
import { HomeIcon, BookOpenIcon, MicIcon, Gamepad2Icon, ChevronLeftIcon, MenuIcon } from "./icons";
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
    <div className="min-h-screen bg-background flex flex-col w-full relative">
      {/* Header */}
      <header className="w-full px-6 py-4 flex flex-col gap-3 sticky top-0 z-50 bg-background border-b border-border/50 shadow-sm">
        <div className="max-w-[1200px] mx-auto w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              {showBack && (
                <Link
                  href="/"
                  className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </Link>
              )}
              {title ? (
                <h1 className="text-3xl md:text-4xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  {title}
                </h1>
              ) : (
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl">
                    L
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-display font-bold text-3xl md:text-4xl">LingoQuest</span>
                    <span className="text-sm text-muted-foreground">
                      Learn daily with reading + voice
                    </span>
                  </div>
                </Link>
              )}
            </div>

            <div className="relative">
              <button
                aria-label="Menu"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <MenuIcon className="w-5 h-5 text-muted-foreground" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-lg border border-border/50 p-4 z-50">
                  {currentUser ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">
                        Logged in as <strong>{currentUser.displayName}</strong>
                      </p>
                      {currentUser.role === "admin" && (
                        <Link
                          href="/admin"
                          className="w-full py-2 px-4 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 text-center font-medium"
                          onClick={() => setMenuOpen(false)}
                        >
                          Show All Accounts
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          logoutMutation.mutate();
                          setMenuOpen(false);
                        }}
                        className="w-full py-2 px-4 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                      >
                        Log Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">Log In</p>
                      {error && <p className="text-xs text-red-500">{error}</p>}
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        type="password"
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => loginMutation.mutate()}
                        className="w-full py-2 px-4 bg-primary text-white rounded-lg text-sm hover:opacity-90"
                      >
                        Log In
                      </button>
                      <Link
                        href="/signup"
                        className="text-xs text-primary text-center mt-1 hover:underline"
                        onClick={() => setMenuOpen(false)}
                      >
                        Create an account
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Desktop navigation row */}
          <div className="hidden md:flex w-full items-center gap-3 pt-1">
            <DesktopNavLink href="/" icon={HomeIcon} label="Home" active={location === "/"} />
            <DesktopNavLink href="/vocab" icon={BookOpenIcon} label="Vocab" active={location === "/vocab"} />
            <DesktopNavLink href="/read" icon={MicIcon} label="Read" active={location === "/read"} />
            <DesktopNavLink href="/adventure" icon={Gamepad2Icon} label="Play" active={location === "/adventure"} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 py-6 pb-24 md:pb-6 overflow-y-auto scrollbar-hide">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[1200px] mx-auto bg-white border-t border-border/50 px-6 py-4 z-50 md:hidden">
        <div className="flex justify-between items-center">
          <NavLink href="/" icon={HomeIcon} label="Home" active={location === "/"} />
          <NavLink href="/vocab" icon={BookOpenIcon} label="Vocab" active={location === "/vocab"} />
          <NavLink href="/read" icon={MicIcon} label="Read" active={location === "/read"} />
          <NavLink href="/adventure" icon={Gamepad2Icon} label="Play" active={location === "/adventure"} />
        </div>
      </nav>
    </div>
  );
}

function DesktopNavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: any;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        flex-1 items-center justify-center flex gap-3 py-3 px-4 rounded-xl transition-colors
        ${active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}
      `}
    >
      <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
      <span className={`text-sm md:text-base font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
    </Link>
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
          <div
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
