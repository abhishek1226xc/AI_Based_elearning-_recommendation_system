import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { BookOpen, Sparkles, TrendingUp, Clock, Star, ArrowRight, Loader2, Flame, Trophy, BarChart3, Target, Bookmark, ExternalLink, LogOut } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

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

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

const PLATFORM_COLORS: Record<string, string> = {
  "Udemy": "bg-purple-100 text-purple-700", "Coursera": "bg-blue-100 text-blue-700",
  "edX": "bg-red-100 text-red-700", "YouTube": "bg-rose-100 text-rose-700",
};

export default function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!isAuthenticated) { navigate("/auth"); return null; }

  const bookmarksQuery = trpc.bookmarks.list.useQuery();
  const recommendationsQuery = trpc.recommendations.getForUser.useQuery({ limit: 8 });
  const interactionsQuery = trpc.enrollment.getInteractions.useQuery();

  const statCards = [
    { icon: Bookmark, label: "Saved Courses", value: bookmarksQuery.data?.length || 0, color: "from-blue-500 to-cyan-500" },
    { icon: BarChart3, label: "Courses Compared", value: interactionsQuery.data?.length || 0, color: "from-emerald-500 to-teal-500" },
    { icon: Sparkles, label: "AI Suggestions", value: recommendationsQuery.data?.length || 0, color: "from-violet-500 to-purple-500" },
    { icon: Trophy, label: "Platforms Tracked", value: "10", suffix: "+", color: "from-amber-500 to-yellow-500" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <motion.div className="flex items-center gap-2 cursor-pointer" whileHover={{ scale: 1.05 }} onClick={() => navigate("/")}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">EduAI</span>
          </motion.div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/courses")} className="font-medium">Courses</Button>
            <Button variant="outline" onClick={async () => { await logout(); navigate("/auth"); }} className="rounded-xl text-red-600 border-red-200 hover:bg-red-50">
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
              <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="text-blue-100 mt-1">
                Your personalized course recommendations
              </motion.p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => navigate("/courses")} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl border border-white/20">
                <Target className="w-4 h-4 mr-2" /> Explore All Courses
              </Button>
            </motion.div>
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
                <Card className="p-5 border-slate-200/80 bg-white/70 backdrop-blur-sm card-hover">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-11 h-11 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{s.label}</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
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
            <div>
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-violet-500" /> AI-Recommended For You
                </h2>
              </motion.div>
              {recommendationsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
              ) : recommendationsQuery.data && recommendationsQuery.data.length > 0 ? (
                <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {recommendationsQuery.data.map((rec: any, i: number) => (
                    <motion.div key={rec.courseId} variants={itemVariants}>
                      <Card className="p-5 border-slate-200/80 bg-white/70 card-hover group cursor-pointer" onClick={() => navigate(`/course/${rec.courseId}`)}>
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-slate-900 flex-1 group-hover:text-blue-600 transition-colors">{rec.reason}</h3>
                          <span className="bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold ml-2">{Math.round(rec.score)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
                          <motion.div initial={{ width: 0 }} whileInView={{ width: `${Math.min(rec.score, 100)}%` }} viewport={{ once: true }}
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
                <Card className="p-10 text-center border-slate-200/80 bg-white/60">
                  <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 mb-4">Browse courses to get personalized recommendations</p>
                  <Button onClick={() => navigate("/courses")} className="rounded-xl">Explore Courses</Button>
                </Card>
              )}
            </div>

            {/* Saved Courses */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Bookmark className="w-6 h-6 text-blue-600" /> Saved Courses
              </h2>
              {bookmarksQuery.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
              ) : bookmarksQuery.data && bookmarksQuery.data.length > 0 ? (
                <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {bookmarksQuery.data.map((b: any) => (
                    <motion.div key={b.id} variants={itemVariants}>
                      <Card className="p-5 border-slate-200/80 bg-white/70 card-hover group cursor-pointer" onClick={() => navigate(`/course/${b.courseId}`)}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex-1">{b.course?.title || `Course #${b.courseId}`}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${PLATFORM_COLORS[b.course?.platform || ""] || "bg-slate-100 text-slate-700"}`}>{b.course?.platform}</span>
                        </div>
                        {b.notes && <p className="text-sm text-slate-500 mb-3 italic">"{b.notes}"</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span className="font-semibold">{((b.course?.rating || 0) / 100).toFixed(1)}</span>
                            <span>·</span>
                            <span className="text-emerald-600 font-semibold">{b.course?.platformPrice}</span>
                          </div>
                          <a href={b.course?.platformUrl || "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="rounded-xl">
                              Go <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </a>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <Card className="p-10 text-center border-slate-200/80 bg-white/60">
                  <Bookmark className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 mb-4">Save courses to compare them later</p>
                  <Button onClick={() => navigate("/courses")} className="rounded-xl">Explore Courses</Button>
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

            <Card className="p-6 border-slate-200/80 bg-white/70 backdrop-blur-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" /> How It Works
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                {[
                  "We index courses from 10+ platforms",
                  "AI compares ratings, reviews, and content",
                  "Get unbiased recommendations",
                  "Click through to learn on the platform",
                ].map((tip, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }} className="flex gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">✦</span><span>{tip}</span>
                  </motion.li>
                ))}
              </ul>
            </Card>

            <Card className="p-6 border-slate-200/80 bg-white/70 backdrop-blur-sm">
              <h3 className="font-bold text-slate-900 mb-3">Your Profile</h3>
              <div className="text-sm text-slate-600 space-y-2">
                <p><span className="font-semibold">Name:</span> {user?.name}</p>
                <p><span className="font-semibold">Email:</span> {user?.email}</p>
                <p><span className="font-semibold">Member since:</span> {new Date(user?.createdAt || "").toLocaleDateString()}</p>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
