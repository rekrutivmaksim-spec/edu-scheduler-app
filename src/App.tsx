
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthNew from "./pages/AuthNew";
import VKCallback from "./pages/VKCallback";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Materials from "./pages/Materials";
import ExamPrep from "./pages/ExamPrep";
import Pricing from "./pages/Pricing";
import Assistant from "./pages/Assistant";
import Calendar from "./pages/Calendar";
import Sharing from "./pages/Sharing";
import Analytics from "./pages/Analytics";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import PaymentSetup from "./pages/PaymentSetup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth" element={<AuthNew />} />
          <Route path="/auth/vk" element={<VKCallback />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/exam-prep" element={<ExamPrep />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/sharing" element={<Sharing />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/payment-setup" element={<PaymentSetup />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;