import RecommendationCard from "@/components/RecommendationCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/hooks/useRecommendations";
import type { FeedbackType, RecommendationItem } from "@shared/types";
import { BookOpen, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  userId: number;
}

type RecommendationWithId = RecommendationItem & {
  recommendationId?: number;
};

function RecommendationPanelSkeleton() {
  return (
    <div className="rounded-xl border p-5">
      <Skeleton className="mb-3 h-5 w-2/3" />
      <Skeleton className="mb-3 h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function RecommendationsPanel({ userId }: Props) {
  const {
    recommendations,
    stats,
    isLoading,
    isError,
    error,
    refresh,
    isRefreshing,
    submitFeedback,
  } = useRecommendations(userId);

  const onFeedback = (recommendationId: number, type: FeedbackType) => {
    submitFeedback(recommendationId, type);
  };

  const algorithmLabel = stats?.algorithmUsed ?? "n/a";
  const avgScoreLabel = stats ? stats.avgScore.toFixed(1) : "0.0";
  const expiresLabel = stats?.expiresAt
    ? formatDistanceToNow(new Date(stats.expiresAt), { addSuffix: true })
    : "n/a";

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recommended for You</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{algorithmLabel}</Badge>
            <Badge className="bg-blue-100 text-blue-700">avgScore {avgScoreLabel}</Badge>
          </div>
        </div>
        <Button onClick={refresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </header>

      {isLoading ? (
        <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RecommendationPanelSkeleton />
          <RecommendationPanelSkeleton />
          <RecommendationPanelSkeleton />
        </div>
      ) : null}

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load recommendations</AlertTitle>
          <AlertDescription>
            <p>{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button size="sm" variant="outline" onClick={refresh}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !isError && recommendations.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-medium text-slate-800">No recommendations yet.</h2>
          <p className="text-slate-500">
            Complete your profile to get personalised suggestions.
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && recommendations.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((item) => {
            const recommendationItem = item as RecommendationWithId;
            const recommendationId = recommendationItem.recommendationId ?? recommendationItem.courseId;

            return (
              <RecommendationCard
                key={`${item.courseId}-${item.rank}`}
                item={item}
                recommendationId={recommendationId}
                onFeedback={onFeedback}
              />
            );
          })}
        </div>
      ) : null}

      <footer className="text-sm text-slate-500">
        Showing {recommendations.length} courses · Top category: {stats?.topCategory ?? "n/a"} · Expires: {expiresLabel}
      </footer>
    </section>
  );
}

export default RecommendationsPanel;
