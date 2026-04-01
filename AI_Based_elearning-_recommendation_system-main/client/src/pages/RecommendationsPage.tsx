import { useEffect } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import RecommendationsPanel from "@/components/RecommendationsPanel";

export function RecommendationsPage() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "My Recommendations — E-Learn AI";
  }, []);

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
