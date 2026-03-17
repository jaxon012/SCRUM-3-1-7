import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import Home from "@/pages/Home";

const Vocab = lazy(() => import("@/pages/Vocab"));
const Read = lazy(() => import("@/pages/Read"));
const Adventure = lazy(() => import("@/pages/Adventure"));
const NotFound = lazy(() => import("@/pages/not-found"));

const LazyToaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const LazyTooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/vocab" component={Vocab} />
        <Route path="/read" component={Read} />
        <Route path="/adventure" component={Adventure} />
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
