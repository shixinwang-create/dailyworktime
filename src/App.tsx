import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import History from "@/pages/history";
import LeaveOvertime from "@/pages/leave-overtime";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { isDarkMode, applyDarkMode } from "@/lib/themes";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/history" component={History} />
        <Route path="/leave-overtime" component={LeaveOvertime} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    applyDarkMode(isDarkMode());

    const loadingEl = document.getElementById("app-loading");
    if (loadingEl) {
      const minDisplayMs = 700;
      const navStart = window.performance?.timing?.navigationStart;
      const elapsed = navStart ? Date.now() - navStart : minDisplayMs;
      const delay = Math.max(0, minDisplayMs - elapsed);

      setTimeout(() => {
        loadingEl.classList.add("fade-out");
        setTimeout(() => loadingEl.remove(), 400);
      }, delay);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
