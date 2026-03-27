import { useQuery } from "@tanstack/react-query";
import { ME_QUERY_KEY } from "@/hooks/use-me";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, navigate] = useLocation();
  const { data: user, isLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetch("/api/me", { credentials: "include" }).then((r) => r.json()),
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
