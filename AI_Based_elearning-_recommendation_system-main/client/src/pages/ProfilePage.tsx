import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";

const parseCourseIds = (raw: string | null | undefined): number[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((id): id is number => typeof id === "number");
  } catch {
    return [];
  }
  return [];
};

export default function ProfilePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const learningPathsQuery = trpc.profile.learningPaths.useQuery(undefined, {
    enabled: Boolean(user?.id),
  });

  const activePath = useMemo(() => {
    const paths = learningPathsQuery.data ?? [];
    return paths.find((path: any) => path.status === "active") ?? paths[0];
  }, [learningPathsQuery.data]);

  const nextCourseId = useMemo(() => {
    if (!activePath) return null;
    const courseIds = parseCourseIds(activePath.courseIds);
    const currentIndex = Math.max(0, Math.min(activePath.currentCourseIndex ?? 0, courseIds.length - 1));
    return courseIds[currentIndex] ?? null;
  }, [activePath]);

  const nextCourseQuery = trpc.courses.getById.useQuery(
    { id: nextCourseId ?? 0 },
    { enabled: Boolean(nextCourseId) }
  );

  const nextCourse = nextCourseQuery.data;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#0b1020_0%,_#0a1224_55%,_#0b0f1a_100%)] text-slate-100 px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Profile</p>
            <h1 className="text-3xl font-semibold mt-2">Loading your overview</h1>
          </div>
          <Card className="admin-card p-6 animate-pulse">
            <div className="h-5 w-40 bg-slate-800/70 rounded" />
            <div className="mt-4 h-4 w-80 bg-slate-800/70 rounded" />
            <div className="mt-2 h-4 w-64 bg-slate-800/70 rounded" />
            <div className="mt-6 h-10 w-40 bg-slate-800/70 rounded" />
          </Card>
          <Card className="admin-card p-6 animate-pulse">
            <div className="h-4 w-52 bg-slate-800/70 rounded" />
            <div className="mt-4 h-3 w-full bg-slate-800/70 rounded" />
            <div className="mt-2 h-3 w-5/6 bg-slate-800/70 rounded" />
          </Card>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#0b1020_0%,_#0a1224_55%,_#0b0f1a_100%)] text-slate-100 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Profile</p>
          <h1 className="text-3xl font-semibold mt-2">Learning overview</h1>
        </div>

        <Card className="admin-card p-6">
          <h2 className="text-xl font-semibold">Recommended next course</h2>
          {nextCourse ? (
            <div className="mt-4 space-y-2">
              <p className="text-lg text-amber-200">{nextCourse.title}</p>
              <p className="text-sm text-slate-400">{nextCourse.description}</p>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>{nextCourse.platform}</span>
                <span>•</span>
                <span>{nextCourse.difficulty}</span>
              </div>
              <Button
                className="mt-3 bg-amber-400 text-slate-950 hover:bg-amber-300 admin-btn"
                onClick={() => nextCourse && navigate(`/course/${nextCourse.id}`)}
              >
                Continue learning
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-3">No active learning path yet.</p>
          )}
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your learning paths</h2>
          {(learningPathsQuery.data ?? []).map((path: any) => {
            const courseIds = parseCourseIds(path.courseIds);
            const progressPct = courseIds.length > 0
              ? Math.round(((path.currentCourseIndex ?? 0) / courseIds.length) * 100)
              : 0;
            return (
              <Card key={path.id} className="admin-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-100">{path.pathName}</p>
                    <p className="text-sm text-slate-400">{path.description}</p>
                  </div>
                  <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs text-amber-200">
                    {path.status}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>{courseIds.length} courses</span>
                    <span>{progressPct}% complete</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
              </Card>
            );
          })}
          {learningPathsQuery.data?.length === 0 && (
            <p className="text-sm text-slate-400">No learning paths yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
