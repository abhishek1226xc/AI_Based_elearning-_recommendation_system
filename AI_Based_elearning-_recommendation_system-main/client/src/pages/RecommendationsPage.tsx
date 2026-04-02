import { useEffect } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import { hasCompletedOnboardingInProfile } from "@/lib/onboarding";
import { trpc } from "@/lib/trpc";

export function RecommendationsPage() {
  const { user, loading } = useAuth();
  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    document.title = "My Recommendations — E-Learn AI";
  }, []);

  if (!loading && !user?.id) {
    return <Redirect to="/login" />;
  }

  if (loading || profileQuery.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">Loading your learning profile...</p>
      </main>
    );
  }

  if (!hasCompletedOnboardingInProfile(profileQuery.data)) {
    return <Redirect to="/onboarding" />;
  }

  if (!user?.id) {
    return <Redirect to="/login" />;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <RecommendationsPanel userId={user.id} />
    </main>
  );
}

export default RecommendationsPage;
