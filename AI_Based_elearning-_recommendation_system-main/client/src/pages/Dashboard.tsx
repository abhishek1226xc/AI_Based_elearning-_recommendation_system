import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { BookOpen, Sparkles, TrendingUp, Clock, Star, ArrowRight, Loader2, Flame, Trophy, BarChart3, Target, Bookmark, ExternalLink, LogOut, Trash2, Zap, RefreshCw } from "lucide-react";
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
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!isAuthenticated) { navigate("/auth"); return null; }

  const utils = trpc.useUtils();
  const bookmarksQuery = trpc.bookmarks.list.useQuery();
  const recommendationsQuery = trpc.recommendations.getForUser.useQuery({ userId: user!.id });
  const interactionsQuery = trpc.enrollment.getInteractions.useQuery();
  const generateMutation = trpc.recommendations.generate.useMutation();
  const removeBookmarkMutation = trpc.bookmarks.remove.useMutation();

  type RecommendationItem = NonNullable<typeof recommendationsQuery.data>[number];
  type BookmarkItem = NonNullable<typeof bookmarksQuery.data>[number];

  const handleGenerateRecommendations = async () => {
    try {
      await generateMutation.mutateAsync({ algorithm: "hybrid" });
      await utils.recommendations.getForUser.invalidate({ userId: user!.id });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-950">
      <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} className="sticky top-0 z-50 glass border-b border-white/20">
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
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div className="flex justify-between items-center">
      <div>
        <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="text-3xl font-bold">
          Welcome, {user?.name}! 👋
        </motion.h1>
        <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="text-purple-200 mt-1">
          Your personalized course recommendations
        </motion.p>
      </div>
    </div>       {/* ✅ closes flex div */}
  </div>         {/* ✅ closes max-w-7xl div */}
</motion.div>    {/* ✅ closes motion.div */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Stats */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10 -mt-8">
          {statCards.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={i} variants={itemVariants}>
                <Card
                  className="p-5 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm card-hover cursor-pointer"
                  onClick={s.onClick}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-11 h-11 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">{s.label}</p>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {typeof s.value === "number" ? <AnimatedNumber value={s.value} suffix={s.suffix || ""} /> : <>{s.value}{s.suffix}</>}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

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
