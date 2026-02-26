
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme-context";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import AuthNew from "./pages/AuthNew";
import VKCallback from "./pages/VKCallback";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Materials from "./pages/Materials";
import Pomodoro from "./pages/Pomodoro";
import Pricing from "./pages/Pricing";
import Assistant from "./pages/Assistant";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Settings from "./pages/Settings";
import Achievements from "./pages/Achievements";
import Referral from "./pages/Referral";
import StudyGroups from "./pages/StudyGroups";
import Widget from "./pages/Widget";
import AppStore from "./pages/AppStore";
import Dashboard from "./pages/Dashboard";
import Exam from "./pages/Exam";
import University from "./pages/University";
import NotFound from "./pages/NotFound";
import Screenshots from "./pages/Screenshots";
import Session from "./pages/Session";
import Flashcards from "./pages/Flashcards";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthNew />} />
              <Route path="/login" element={<AuthNew />} />
              <Route path="/register" element={<AuthNew />} />
              <Route path="/auth/vk" element={<VKCallback />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/materials" element={<Materials />} />
              <Route path="/pomodoro" element={<Pomodoro />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/app" element={<AppStore />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/subscription" element={<Navigate to="/pricing" replace />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/referral" element={<Referral />} />
              <Route path="/groups" element={<StudyGroups />} />
              <Route path="/widget" element={<Widget />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/exam" element={<Exam />} />
              <Route path="/university" element={<University />} />
              <Route path="/screenshots" element={<Screenshots />} />
              <Route path="/session" element={<Session />} />
              <Route path="/flashcards" element={<Flashcards />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;