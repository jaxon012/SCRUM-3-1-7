import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import Login from "@/pages/Login";

const Vocab = lazy(() => import("@/pages/Vocab"));
const Read = lazy(() => import("@/pages/Read"));
const Adventure = lazy(() => import("@/pages/Adventure"));
const Signup = lazy(() => import("@/pages/Signup"));
const Admin = lazy(() => import("@/pages/Admin"));
const NotFound = lazy(() => import("@/pages/not-found"));

const LazyToaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const LazyTooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/">
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        </Route>
        <Route path="/vocab">
          <ProtectedRoute>
            <Vocab />
          </ProtectedRoute>
        </Route>
        <Route path="/read">
          <ProtectedRoute>
            <Read />
          </ProtectedRoute>
        </Route>
        <Route path="/adventure">
          <ProtectedRoute>
            <Adventure />
          </ProtectedRoute>
        </Route>
        <Route path="/admin">
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense>
        <LazyTooltipProvider>
          <LazyToaster />
          <Router />
        </LazyTooltipProvider>
      </Suspense>
    </QueryClientProvider>
  );
}

export default App;
