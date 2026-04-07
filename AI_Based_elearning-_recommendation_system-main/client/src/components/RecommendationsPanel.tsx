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

  const onFeedback = async (recommendationId: number, type: FeedbackType) => {
    await submitFeedback(recommendationId, type);
  };

  const algorithmLabel = stats?.algorithmUsed ?? "n/a";
  const avgScoreLabel = stats ? stats.avgScore.toFixed(1) : "0.0";
  const expiresLabel = stats?.expiresAt
    ? formatDistanceToNow(new Date(stats.expiresAt), { addSuffix: true })
    : "n/a";

  return (
    <section className="space-y-6 rounded-[2rem] border border-slate-200/80 bg-white/75 p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/65">
      <header className="relative overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-blue-500/15 dark:border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.16),_transparent_28%),linear-gradient(135deg,transparent,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Adaptive recommendations</p>
            <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Recommended for You</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className="border border-white/20 bg-white/10 text-white">{algorithmLabel}</Badge>
              <Badge className="border border-white/20 bg-white/10 text-white">avgScore {avgScoreLabel}</Badge>
              <Badge className="border border-white/20 bg-white/10 text-white">Top category {stats?.topCategory ?? "n/a"}</Badge>
            </div>
          </div>
          <Button onClick={refresh} disabled={isRefreshing} className="rounded-2xl bg-white text-indigo-700 shadow-lg shadow-indigo-950/10 hover:bg-blue-50">
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
        </div>
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
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-10 text-center dark:border-white/10 dark:bg-slate-900/40">
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

      <footer className="text-sm text-slate-500 dark:text-slate-400">
        Showing {recommendations.length} courses · Top category: {stats?.topCategory ?? "n/a"} · Expires: {expiresLabel}
      </footer>
    </section>
  );
}

export default RecommendationsPanel;
