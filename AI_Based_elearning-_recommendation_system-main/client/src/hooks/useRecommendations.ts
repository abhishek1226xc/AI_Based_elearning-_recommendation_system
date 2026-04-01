import { trpc } from "@/lib/trpc";
import type {
  FeedbackType,
  RecommendationItem,
  RecommendationStats,
} from "@shared/types";

type RawRecommendationItem = Omit<RecommendationItem, "tags"> & {
  tags: string[] | string | null;
};

const parseTags = (tags: RawRecommendationItem["tags"]): string[] => {
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === "string");
  }

  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((tag): tag is string => typeof tag === "string");
      }
    } catch {
      return [];
    }
  }

  return [];
};

export function useRecommendations(userId: number) {
  const utils = trpc.useUtils();

  const recommendationsQuery = trpc.recommendations.getForUser.useQuery(
    { userId },
    {
      enabled: !!userId,
      staleTime: 1000 * 60 * 20,
      retry: 1,
    }
  );

  const refreshMutation = trpc.recommendations.refresh.useMutation({
    onSuccess: async () => {
      await utils.recommendations.getForUser.invalidate({ userId });
      await utils.recommendations.getStats.invalidate({ userId });
    },
  });

  const feedbackMutation = trpc.recommendations.submitFeedback.useMutation();

  const statsQuery = trpc.recommendations.getStats.useQuery(
    { userId },
    {
      enabled: !!userId,
    }
  );

  const recommendations: RecommendationItem[] =
    (recommendationsQuery.data as RawRecommendationItem[] | undefined)?.map(
      (item) => ({
        ...item,
        tags: parseTags(item.tags),
      })
    ) ?? [];

  const stats = (statsQuery.data ?? undefined) as RecommendationStats | undefined;

  const error = recommendationsQuery.error ?? statsQuery.error ?? null;

  return {
    recommendations,
    stats,
    isLoading: recommendationsQuery.isLoading || statsQuery.isLoading,
    isError: recommendationsQuery.isError || statsQuery.isError,
    error,
    refresh: () => refreshMutation.mutate({ userId }),
    isRefreshing: refreshMutation.isPending,
    submitFeedback: (recommendationId: number, type: FeedbackType) =>
      feedbackMutation.mutate({ recommendationId, feedback: type }),
  };
}
