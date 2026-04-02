import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { hasCompletedOnboardingInProfile } from "@/lib/onboarding";
import { useLocation } from "wouter";
import { BookOpen, Sparkles, TrendingUp, Clock, Star, ArrowRight, Loader2, Flame, Trophy, BarChart3, Target, Bookmark, ExternalLink, LogOut, Trash2, Zap, RefreshCw, PlayCircle, CircleCheckBig } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, type Variants, type Easing } from "framer-motion";
import { toast } from "sonner";

function AnimatedNumber({ value, suffix = "" }: { value: number | string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const numValue = typeof value === "number" ? value : parseInt(value) || 0;
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let s = 0;
        const step = numValue / 40;
        const t = setInterval(() => { s += step; if (s >= numValue) { setDisplay(numValue); clearInterval(t); } else setDisplay(Math.floor(s)); }, 25);
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [numValue]);
  return <span ref={ref}>{display}{suffix}</span>;
}

const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as Easing } } };

const PLATFORM_COLORS: Record<string, string> = {
  "Udemy": "bg-purple-100 text-purple-700", "Coursera": "bg-blue-100 text-blue-700",
  "edX": "bg-red-100 text-red-700", "YouTube": "bg-rose-100 text-rose-700",
};

export default function Dashboard() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [, navigate] = useLocation();
  const userId = user?.id ?? 0;
  const canQueryUserData = isAuthenticated && userId > 0;

  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: canQueryUserData,
  });
  const enrolledCoursesQuery = trpc.enrollment.enrolledCourses.useQuery(undefined, {
    enabled: canQueryUserData,
  });

  const bookmarksQuery = trpc.bookmarks.list.useQuery(undefined, {
    enabled: canQueryUserData,
  });
  const recommendationsQuery = trpc.recommendations.getForUser.useQuery(
    { userId },
    { enabled: canQueryUserData }
  );
  const interactionsQuery = trpc.enrollment.getInteractions.useQuery(undefined, {
    enabled: canQueryUserData,
  });
  const generateMutation = trpc.recommendations.generate.useMutation();
  const removeBookmarkMutation = trpc.bookmarks.remove.useMutation();

  const continueCourse = enrolledCoursesQuery.data?.find((course) => {
    return course.status === "in-progress" || (course.completionPercentage ?? 0) < 100;
  }) ?? enrolledCoursesQuery.data?.[0] ?? null;

  const progressPercent = continueCourse?.completionPercentage ?? 0;

  const continueCourseQuery = trpc.courses.getById.useQuery(
    { id: continueCourse?.courseId ?? 0 },
    { enabled: Boolean(continueCourse?.courseId) }
  );

  if (!loading && !isAuthenticated) { navigate("/auth"); return null; }
  if (loading || profileQuery.isLoading) {
    return <div className="min-h-screen bg-slate-950 text-slate-300 p-8">Loading your learning profile...</div>;
  }
  if (!hasCompletedOnboardingInProfile(profileQuery.data)) { navigate("/onboarding"); return null; }

  type RecommendationItem = NonNullable<typeof recommendationsQuery.data>[number];
  type BookmarkItem = NonNullable<typeof bookmarksQuery.data>[number];

  const handleGenerateRecommendations = async () => {
    try {
      await generateMutation.mutateAsync({ algorithm: "hybrid" });
      await utils.recommendations.getForUser.invalidate({ userId });
      toast.success("Recommendations generated! 🎯");
    } catch {
      toast.error("Failed to generate recommendations");
    }
  };

  const handleRemoveBookmark = async (courseId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeBookmarkMutation.mutateAsync({ courseId });
      await utils.bookmarks.list.invalidate();
      toast.success("Removed from saved courses");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const statCards = [
    { icon: Bookmark, label: "Saved Courses", value: bookmarksQuery.data?.length || 0, color: "from-blue-500 to-cyan-500", onClick: () => document.getElementById("saved-courses")?.scrollIntoView({ behavior: "smooth" }) },
    { icon: BarChart3, label: "Courses Compared", value: interactionsQuery.data?.length || 0, color: "from-emerald-500 to-teal-500", onClick: () => navigate("/courses") },
    { icon: Sparkles, label: "AI Suggestions", value: recommendationsQuery.data?.length || 0, color: "from-violet-500 to-purple-500", onClick: () => document.getElementById("ai-recs")?.scrollIntoView({ behavior: "smooth" }) },
    { icon: Trophy, label: "Platforms Tracked", value: "6", suffix: "", color: "from-amber-500 to-yellow-500", onClick: () => navigate("/courses") },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.18),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]">
      <div className="pointer-events-none absolute inset-0 soft-grid opacity-20" />
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-36 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl" />

      <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <motion.div className="flex items-center gap-2 cursor-pointer" whileHover={{ scale: 1.05 }} onClick={() => navigate("/")}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">EduAI</span>
          </motion.div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/courses")} className="font-medium text-slate-100 hover:text-white">Courses</Button>
            <Button variant="ghost" onClick={() => navigate("/recommendations")} className="font-medium text-slate-100 hover:text-white">Recommendations</Button>
            <Button variant="outline" onClick={async () => { await logout(); navigate("/auth"); }} className="rounded-xl text-red-300 border-red-600/50 hover:bg-red-900/50">
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.16),_transparent_28%),linear-gradient(135deg,transparent,rgba(255,255,255,0.08),transparent)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur">
                Personalized dashboard
              </motion.p>
              <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="mt-4 text-3xl font-bold md:text-4xl">
                Welcome, {user?.name}! 👋
              </motion.h1>
              <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="mt-2 max-w-2xl text-blue-100">
                Your personalized course recommendations, saved learning trail, and platform comparisons are ready to explore.
              </motion.p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[
                { label: "Saved", value: bookmarksQuery.data?.length || 0 },
                { label: "Compared", value: interactionsQuery.data?.length || 0 },
                { label: "AI picks", value: recommendationsQuery.data?.length || 0 },
              ].map((chip) => (
                <div key={chip.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
                  <p className="text-2xl font-bold text-white">{chip.value}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-blue-100">{chip.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Stats */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10 -mt-8">
          {statCards.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={i} variants={itemVariants}>
                <Card
                  className="surface-card surface-card-hover p-5 cursor-pointer border-white/10 bg-white/10 text-white backdrop-blur-xl"
                  onClick={s.onClick}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-11 h-11 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm text-slate-200 font-medium">{s.label}</p>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {typeof s.value === "number" ? <AnimatedNumber value={s.value} suffix={s.suffix || ""} /> : <>{s.value}{s.suffix}</>}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2">
            <Card className="surface-card p-6 md:p-8 bg-white/95">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Learning momentum</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Continue where you left off</h2>
                  <p className="mt-2 text-slate-600">Pick up the next lesson or revisit your latest in-progress course without digging through the catalog.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div className="mb-2 flex items-center gap-2 text-slate-800">
                    <CircleCheckBig className="h-4 w-4 text-emerald-600" />
                    <span>{progressPercent}% complete</span>
                  </div>
                  <Progress value={Math.max(0, Math.min(progressPercent, 100))} className="h-2.5 w-44" />
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5">
                {continueCourseQuery.isLoading ? (
                  <div className="flex items-center gap-3 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading your next course...
                  </div>
                ) : continueCourseQuery.data ? (
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="max-w-2xl">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        <PlayCircle className="h-4 w-4 text-blue-600" />
                        Resume course
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{continueCourseQuery.data.title}</h3>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{continueCourseQuery.data.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span>{continueCourseQuery.data.platform}</span>
                        <span>•</span>
                        <span>{continueCourseQuery.data.category}</span>
                        <span>•</span>
                        <span>{continueCourseQuery.data.difficulty}</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => navigate(`/course/${continueCourseQuery.data!.id}`)} className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
                        Continue course <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">No active course yet</p>
                      <p className="text-sm text-slate-600">Explore courses and start one to unlock progress tracking here.</p>
                    </div>
                    <Button onClick={() => navigate("/courses")} className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
                      Browse courses
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="surface-card p-6 bg-white/95">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Roadmap snapshot</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Your current progress</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Study progress</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <Progress value={Math.max(0, Math.min(progressPercent, 100))} className="h-2.5" />
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Focus for today</p>
                  <p className="mt-1 text-sm text-slate-600">Complete one focused lesson, then review notes and bookmark one useful resource.</p>
                </div>
                <Button variant="outline" className="w-full rounded-2xl" onClick={() => navigate("/recommendations")}>
                  View your recommendations
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-10">
            {/* AI Recommendations */}
            <div id="ai-recs">
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-violet-500" /> AI-Recommended For You
                </h2>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={handleGenerateRecommendations}
                    disabled={generateMutation.isPending}
                    variant="outline"
                    className="rounded-xl text-sm border-violet-200 text-violet-700 hover:bg-violet-50"
                  >
                    {generateMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</>
                    ) : (
                      <><Zap className="w-4 h-4 mr-1" /> Generate New</>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
              {recommendationsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
              ) : recommendationsQuery.data && recommendationsQuery.data.length > 0 ? (
                <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {recommendationsQuery.data.map((rec: RecommendationItem, i: number) => (
                    <motion.div key={rec.courseId} variants={itemVariants}>
                      <Card className="p-5 border-purple-500/30 bg-slate-800/50 card-hover group cursor-pointer" onClick={() => navigate(`/course/${rec.courseId}`)}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white flex-1 group-hover:text-purple-300 transition-colors">
                            {rec.title || rec.reason}
                          </h3>
                          <span className="bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold ml-2">
                            {Math.round(rec.score ?? 0)}%
                          </span>
                        </div>
                        {rec.platform && (
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold mb-2 ${PLATFORM_COLORS[rec.platform] || "bg-slate-100 text-slate-700"}`}>
                            {rec.platform}
                          </span>
                        )}
                        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{rec.reason}</p>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
                          <motion.div initial={{ width: 0 }} whileInView={{ width: `${Math.min(rec.score ?? 0, 100)}%` }} viewport={{ once: true }}
                            transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }} className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full" />
                        </div>
                        <Button size="sm" className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          View Course <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <Card className="p-10 text-center border-purple-500/30 bg-slate-800/50">
                  <Zap className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                  <p className="text-white font-medium mb-2">No recommendations yet</p>
                  <p className="text-slate-400 text-sm mb-5">Click "Generate New" above to get AI-powered course suggestions based on your interests.</p>
                  <Button
                    onClick={handleGenerateRecommendations}
                    disabled={generateMutation.isPending}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"
                  >
                    {generateMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1" /> Generate Recommendations</>
                    )}
                  </Button>
                </Card>
              )}
            </div>

            {/* Saved Courses */}
            <div id="saved-courses">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Bookmark className="w-6 h-6 text-blue-600" /> Saved Courses
                </h2>
                {bookmarksQuery.data && bookmarksQuery.data.length > 0 && (
                  <span className="text-sm text-slate-400">{bookmarksQuery.data.length} course{bookmarksQuery.data.length > 1 ? "s" : ""} saved</span>
                )}
              </div>
              {bookmarksQuery.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
              ) : bookmarksQuery.data && bookmarksQuery.data.length > 0 ? (
                <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {bookmarksQuery.data.map((b: BookmarkItem) => (
                    <motion.div key={b.id} variants={itemVariants}>
                      <Card className="p-5 border-purple-500/30 bg-slate-800/50 card-hover group cursor-pointer relative" onClick={() => navigate(`/course/${b.courseId}`)}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors flex-1 pr-2">
                            {b.course?.title || `Course #${b.courseId}`}
                          </h3>
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${PLATFORM_COLORS[b.course?.platform || ""] || "bg-slate-100 text-slate-700"}`}>
                              {b.course?.platform}
                            </span>
                          </div>
                        </div>
                        {b.course?.description && (
                          <p className="text-xs text-slate-400 mb-3 line-clamp-2">{b.course.description}</p>
                        )}
                        {b.notes && <p className="text-sm text-slate-400 mb-3 italic">"{b.notes}"</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span className="font-semibold">{((b.course?.rating || 0) / 100).toFixed(1)}</span>
                            <span>·</span>
                            <span className="text-emerald-600 font-semibold">{b.course?.platformPrice}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => handleRemoveBookmark(b.courseId, e)}
                              disabled={removeBookmarkMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Remove
                            </Button>
                            <a href={b.course?.platformUrl || "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" className="rounded-xl">
                                Go <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <Card className="p-10 text-center border-purple-500/30 bg-slate-800/50">
                  <Bookmark className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                  <p className="text-white font-medium mb-2">No saved courses yet</p>
                  <p className="text-slate-400 text-sm mb-5">Browse courses and click "Save to My List" to save them here for comparison.</p>
                  <Button onClick={() => navigate("/courses")} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
                    Explore Courses
                  </Button>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white border-0 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <h3 className="text-lg font-bold mb-2">🔥 Trending This Week</h3>
                <p className="text-blue-100 text-sm mb-4">Top-rated courses across all platforms</p>
                <Button className="w-full bg-white text-indigo-600 hover:bg-slate-100 rounded-xl font-semibold" onClick={() => navigate("/courses")}>
                  Discover Trending
                </Button>
              </div>
            </Card>

            <Card className="p-6 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-400" /> How It Works
              </h3>
              <ul className="space-y-3 text-sm text-slate-400">
                {[
                  "We index courses from 6 real platforms",
                  "AI compares ratings, reviews, and content",
                  "Get unbiased recommendations",
                  "Click through to learn on the platform",
                ].map((tip, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }} className="flex gap-2">
                    <span className="text-purple-400 font-bold mt-0.5">✦</span><span>{tip}</span>
                  </motion.li>
                ))}
              </ul>
            </Card>

            <Card className="p-6 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm">
              <h3 className="font-bold text-white mb-3">Your Profile</h3>
              <div className="text-sm text-slate-400 space-y-2">
                <p><span className="font-semibold">Name:</span> {user?.name}</p>
                <p><span className="font-semibold">Email:</span> {user?.email}</p>
                <p><span className="font-semibold">Member since:</span> {new Date(user?.createdAt || "").toLocaleDateString()}</p>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" /> Quick Actions
              </h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start rounded-xl border-purple-500/30 text-slate-300 hover:bg-purple-900/50" onClick={() => navigate("/courses")}>
                  <BookOpen className="w-4 h-4 mr-2" /> Browse All Courses
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                  onClick={handleGenerateRecommendations}
                  disabled={generateMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                  {generateMutation.isPending ? "Generating..." : "Refresh Recommendations"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
