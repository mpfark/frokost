import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useCompanyColors } from "@/hooks/useCompanyColors";
import { ReloadPrompt } from "@/components/ReloadPrompt";
import Index from "./pages/Index";
import ResetPassword from "./pages/ResetPassword";
import SetPassword from "./pages/SetPassword";
import AcceptInvitation from "./pages/AcceptInvitation";
import Install from "./pages/Install";
import Guide from "./pages/Guide";
import MicrosoftCallback from "./pages/MicrosoftCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useCompanyColors();
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/accept-invitation/:invitationId" element={<AcceptInvitation />} />
        <Route path="/install" element={<Install />} />
        <Route path="/guide" element={<Guide />} />
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
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
