
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme-context";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthNew from "./pages/AuthNew";
import VKCallback from "./pages/VKCallback";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Materials from "./pages/Materials";
import Pomodoro from "./pages/Pomodoro";
import Pricing from "./pages/Pricing";
import Assistant from "./pages/Assistant";
import Calendar from "./pages/Calendar";
import Analytics from "./pages/Analytics";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import Achievements from "./pages/Achievements";
import GradeBook from "./pages/GradeBook";
import Referral from "./pages/Referral";
import StudyGroups from "./pages/StudyGroups";
import Widget from "./pages/Widget";
import AppStore from "./pages/AppStore";
import Dashboard from "./pages/Dashboard";
import Exam from "./pages/Exam";
import Flashcards from "./pages/Flashcards";
import NotFound from "./pages/NotFound";

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
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth" element={<AuthNew />} />
              <Route path="/auth/vk" element={<VKCallback />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/materials" element={<Materials />} />
              <Route path="/pomodoro" element={<Pomodoro />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/app" element={<AppStore />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/gradebook" element={<GradeBook />} />
              <Route path="/referral" element={<Referral />} />
              <Route path="/groups" element={<StudyGroups />} />
              <Route path="/widget" element={<Widget />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/exam" element={<Exam />} />
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