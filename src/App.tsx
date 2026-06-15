import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useCompanyColors } from "@/hooks/useCompanyColors";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { ReloadPrompt } from "@/components/notifications/ReloadPrompt";
import Index from "./pages/Index";
import Platform from "./pages/Platform";
import SetPassword from "./pages/SetPassword";
import AcceptInvitation from "./pages/AcceptInvitation";
import Install from "./pages/Install";
import Guide from "./pages/Guide";
import MicrosoftCallback from "./pages/MicrosoftCallback";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useCompanyColors();
  const { mode } = useTenant();

  if (mode === "platform") {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Platform />} />
          <Route path="*" element={<Platform />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/accept-invitation/:inviteCode" element={<AcceptInvitation />} />
        <Route path="/install" element={<Install />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/microsoft-callback" element={<MicrosoftCallback />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ReloadPrompt />
      <TenantProvider>
        <AppContent />
      </TenantProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
