import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TenantProvider } from "@/contexts/TenantContext";
import { ReloadPrompt } from "@/components/notifications/ReloadPrompt";
import Index from "./pages/Index";
import Install from "./pages/Install";
import Guide from "./pages/Guide";
import MicrosoftCallback from "./pages/MicrosoftCallback";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";

import { AppLayout } from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

const AppContent = () => (
  <>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Index />} />
          <Route path="/set-password" element={<Navigate to="/" replace />} />
          <Route path="/accept-invitation/:inviteCode" element={<Navigate to="/" replace />} />
          <Route path="/install" element={<Install />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="*" element={<NotFound />} />
          <Route path="/microsoft-callback" element={<MicrosoftCallback />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
        </Route>

      </Routes>
    </BrowserRouter>
  </>
);

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
