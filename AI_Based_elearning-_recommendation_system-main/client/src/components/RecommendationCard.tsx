import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FeedbackType, RecommendationItem } from "@shared/types";
import {
  BookOpen,
  Clock,
  ExternalLink,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  CheckCircle2,
} from "lucide-react";

interface Props {
  item: RecommendationItem;
  onFeedback: (id: number, type: FeedbackType) => void;
  recommendationId: number;
}

const formatDuration = (duration: number | null): string => {
  if (!duration || duration <= 0) return "N/A";
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const formatLearners = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
};

const scoreClasses = (score: number): string => {
  if (score >= 70) return "bg-emerald-100 text-emerald-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

const difficultyClasses: Record<RecommendationItem["difficulty"], string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-rose-100 text-rose-700",
};

export function RecommendationCard({ item, onFeedback, recommendationId }: Props) {
  const visibleTags = item.tags.slice(0, 4);
  const hiddenTagCount = Math.max(item.tags.length - visibleTags.length, 0);

  return (
    <Card className="group relative overflow-hidden border-slate-200/80 bg-white/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/75">
      <div className="absolute top-3 left-3 z-10">
        <Badge className="bg-slate-950/90 text-white shadow-lg shadow-slate-950/10">#{item.rank}</Badge>
      </div>

      <CardHeader className="pt-10 pb-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">{item.title}</h3>
          <Badge className={`${scoreClasses(item.score)} border-0 shadow-sm`}>
            {item.score}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{item.category}</Badge>
          <Badge className={`${difficultyClasses[item.difficulty]} border-0 capitalize`}>
            {item.difficulty}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {item.platform}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDuration(item.duration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{formatLearners(item.learnerCount)} learners</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-500" />
            <span>{(item.rating / 100).toFixed(1)} / 5.0</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{item.platformPrice}</span>
          </div>
        </div>

        <p className="italic text-slate-500 dark:text-slate-400">{item.reason}</p>

        <div className="flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="outline" className="bg-slate-100 text-slate-600">
              {tag}
            </Badge>
          ))}
          {hiddenTagCount > 0 ? (
            <Badge variant="outline" className="bg-slate-100 text-slate-600">
              +{hiddenTagCount} more
            </Badge>
          ) : null}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">Instructor: {item.instructor ?? "Unknown"}</p>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Mark recommendation as relevant"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onFeedback(recommendationId, "relevant")}
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Relevant</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Mark recommendation as not relevant"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onFeedback(recommendationId, "not_relevant")}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Not relevant</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Mark recommendation as already done"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onFeedback(recommendationId, "already_done")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Already done</TooltipContent>
            </Tooltip>
          </div>

          <Button
            asChild
            size="sm"
            className="ml-auto rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/15"
            disabled={!item.platformUrl}
          >
            <a href={item.platformUrl ?? "#"} target="_blank" rel="noreferrer noopener">
              View Course
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default RecommendationCard;
