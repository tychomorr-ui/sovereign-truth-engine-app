import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PortalChat from "@/pages/PortalChat";
import NotFound from "@/pages/NotFound";
import KeiraVerify from "@/pages/KeiraVerify";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PortalChat} />
      <Route path="/portal-chat" component={PortalChat} />
      <Route path="/keira/verify" component={KeiraVerify} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.title = import.meta.env.VITE_APP_TITLE || "KEIRA";
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

/**
 * KEIRA is the active product surface for this application.
 * Historical Mirror and Knowledge Graph pages remain in source for
 * separation and rollback, but are intentionally not registered here.
 */
export default App;
