import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Suspense, lazy } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { hasCompletedOnboardingInProfile } from "@/lib/onboarding";

// Lazy load pages for code splitting
const Home = lazy(() => import("@/pages/Home"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Courses = lazy(() => import("@/pages/Courses"));
const CourseDetail = lazy(() => import("@/pages/CourseDetail"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const RecommendationsPage = lazy(() => import("@/pages/RecommendationsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));

const AdminLoginPage = lazy(() => import("@/admin/AdminLoginPage"));
const AdminDashboard = lazy(() => import("@/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("@/admin/AdminUsers"));
const AdminUserDetail = lazy(() => import("@/admin/AdminUserDetail"));
const AdminCourses = lazy(() => import("@/admin/AdminCourses"));
const AdminActivityLog = lazy(() => import("@/admin/AdminActivityLog"));
const AdminSettings = lazy(() => import("@/admin/AdminSettings"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function LandingRedirect() {
  const { user, loading } = useAuth();
  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: Boolean(user?.id),
  });

  if (loading || (user?.id && profileQuery.isLoading)) {
    return <PageLoader />;
  }

  if (!user?.id) {
    return <Redirect to="/auth" />;
  }

  if (!hasCompletedOnboardingInProfile(profileQuery.data)) {
    return <Redirect to="/onboarding" />;
  }

  return <Redirect to="/dashboard" />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path={"/"} component={LandingRedirect} />
        <Route path={"/home"} component={Home} />
        <Route path={"/dashboard"} component={Dashboard} />
        <Route path={"/profile"} component={ProfilePage} />
        <Route path={"/courses"} component={Courses} />
        <Route path={"/course/:id"} component={CourseDetail} />
        <Route path={"/auth"} component={AuthPage} />
        <Route path={"/login"} component={AuthPage} />
        <Route path={"/reset-password"} component={ResetPasswordPage} />
        <Route path={"/onboarding"} component={OnboardingPage} />
        <Route path={"/recommendations"} component={RecommendationsPage} />

        <Route path={"/admin/login"} component={AdminLoginPage} />
        <Route path={"/admin"} component={() => <Redirect to="/admin/dashboard" />} />
        <Route path={"/admin/dashboard"} component={AdminDashboard} />
        <Route path={"/admin/users"} component={AdminUsers} />
        <Route path={"/admin/users/:userId"} component={AdminUserDetail} />
        <Route path={"/admin/courses"} component={AdminCourses} />
        <Route path={"/admin/activity-log"} component={AdminActivityLog} />
        <Route path={"/admin/settings"} component={AdminSettings} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
