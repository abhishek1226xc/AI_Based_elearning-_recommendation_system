import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Search, Clock, Star, Users, ArrowLeft, BookOpen, X, ExternalLink, Globe, Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChatBox } from "@/components/ChatBox";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const PLATFORM_COLORS: Record<string, string> = {
  "Udemy": "bg-purple-100 text-purple-700 border-purple-200",
  "Coursera": "bg-blue-100 text-blue-700 border-blue-200",
  "edX": "bg-red-100 text-red-700 border-red-200",
  "YouTube": "bg-rose-100 text-rose-700 border-rose-200",
  "Pluralsight": "bg-pink-100 text-pink-700 border-pink-200",
  "Khan Academy": "bg-green-100 text-green-700 border-green-200",
  "freeCodeCamp": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "MIT OpenCourseWare": "bg-orange-100 text-orange-700 border-orange-200",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } }
};
const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

function SkeletonCard() {
  return (
    <Card className="overflow-hidden border-slate-200/80">
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-100 to-slate-50">
        <div className="skeleton h-5 w-3/4 mb-3" />
        <div className="skeleton h-4 w-1/3" />
      </div>
      <div className="p-6">
        <div className="skeleton h-4 w-full mb-2" />
        <div className="skeleton h-4 w-2/3 mb-4" />
        <div className="skeleton h-10 w-full rounded-xl" />
      </div>
    </Card>
  );
}

export default function Courses() {
  const MAX_VISIBLE_COURSES = 100;

  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [visibleLimit, setVisibleLimit] = useState(24);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"rating" | "reviews" | "learners">("rating");

  const utils = trpc.useUtils();
  const coursesQuery = trpc.courses.list.useQuery({ limit: visibleLimit, offset: 0 });
  const categoriesQuery = trpc.courses.categories.useQuery();
  const topRatedQuery = trpc.courses.topRated.useQuery({ limit: 12 });
  const recommendationsQuery = trpc.recommendations.getForUser.useQuery(
    { limit: 20 },
    { enabled: isAuthenticated }
  );
  const bookmarksQuery = trpc.bookmarks.list.useQuery(undefined, { enabled: isAuthenticated });
  const addBookmark = trpc.bookmarks.add.useMutation();
  const removeBookmark = trpc.bookmarks.remove.useMutation();

  const bookmarkedIds = useMemo(() => {
    if (!bookmarksQuery.data) return new Set<number>();
    return new Set(bookmarksQuery.data.map((b: any) => b.courseId));
  }, [bookmarksQuery.data]);

  const aiRecommendedIds = useMemo(() => {
    if (isAuthenticated && recommendationsQuery.data && recommendationsQuery.data.length > 0) {
      return new Set(recommendationsQuery.data.map((rec: any) => rec.courseId));
    }

    if (topRatedQuery.data && topRatedQuery.data.length > 0) {
      return new Set(topRatedQuery.data.map((course) => course.id));
    }

    return new Set<number>();
  }, [isAuthenticated, recommendationsQuery.data, topRatedQuery.data]);

  const handleToggleBookmark = async (courseId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) { navigate("/auth"); return; }
    try {
      if (bookmarkedIds.has(courseId)) {
        await removeBookmark.mutateAsync({ courseId });
        toast.success("Removed from saved courses");
      } else {
        await addBookmark.mutateAsync({ courseId });
        toast.success("Saved to your list! 🔖");
      }
      await utils.bookmarks.list.invalidate();
    } catch { toast.error("Failed to update"); }
  };

  const filteredCourses = useMemo(() => {
    if (!coursesQuery.data) return [];
    let filtered = coursesQuery.data.filter(course => {
      const matchesSearch = !searchQuery ||
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || course.category === selectedCategory;
      const matchesDifficulty = !selectedDifficulty || course.difficulty === selectedDifficulty;
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
    // Sort
    filtered.sort((a, b) => {
      const aAiRecommended = aiRecommendedIds.has(a.id) ? 1 : 0;
      const bAiRecommended = aiRecommendedIds.has(b.id) ? 1 : 0;
      if (aAiRecommended !== bAiRecommended) {
        return bAiRecommended - aAiRecommended;
      }
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "reviews") return (b.reviewCount || 0) - (a.reviewCount || 0);
      return (b.learnerCount || 0) - (a.learnerCount || 0);
    });
    return filtered;
  }, [coursesQuery.data, searchQuery, selectedCategory, selectedDifficulty, sortBy, aiRecommendedIds]);

  const activeFilters = [searchQuery, selectedCategory, selectedDifficulty].filter(Boolean).length;
  const canLoadMore =
    !coursesQuery.isLoading &&
    visibleLimit < MAX_VISIBLE_COURSES &&
    (coursesQuery.data?.length || 0) >= visibleLimit;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Nav */}
      <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.5 }} className="sticky top-0 z-50 glass border-b border-white/20 dark:border-slate-700 dark:bg-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <motion.div className="flex items-center gap-2 cursor-pointer" whileHover={{ scale: 1.05 }} onClick={() => navigate("/")}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">EduAI</span>
          </motion.div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="font-medium">Dashboard</Button>
            <Button variant="outline" onClick={() => navigate("/")} className="rounded-xl">Home</Button>
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Compare & Discover Courses</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            <Globe className="w-5 h-5 inline mr-1" />
            Explore <span className="font-semibold text-slate-900 dark:text-white">{coursesQuery.data?.length || "1000+"} premium courses</span> — all AI-ranked and ready to learn
          </p>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-1">
            <div className="sticky top-28 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Search Courses</label>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full text-xs font-medium text-blue-700">
                    <Sparkles size={12} /> AI Powered
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input placeholder="Try: deep learning, react, python..." className="pl-10 rounded-xl border-slate-200 bg-white/80" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
                </div>
              </div>

              {/* Sort By */}
              <Card className="p-5 border-slate-200/80 bg-white/60 backdrop-blur-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Sort By</h3>
                <div className="space-y-1">
                  {[
                    { key: "rating" as const, label: "Highest Rated" },
                    { key: "reviews" as const, label: "Most Reviews" },
                    { key: "learners" as const, label: "Most Learners" },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setSortBy(key)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${sortBy === key ? "bg-blue-100 text-blue-700 font-semibold shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="p-5 border-slate-200/80 bg-white/60 backdrop-blur-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Category</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  <button onClick={() => setSelectedCategory(null)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${!selectedCategory ? "bg-blue-100 text-blue-700 font-semibold shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                    All Categories
                  </button>
                  {categoriesQuery.data?.map((cat) => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${selectedCategory === cat ? "bg-blue-100 text-blue-700 font-semibold shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="p-5 border-slate-200/80 bg-white/60 backdrop-blur-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Level</h3>
                <div className="space-y-1">
                  {[
                    { level: "beginner", color: "bg-emerald-100 text-emerald-700" },
                    { level: "intermediate", color: "bg-blue-100 text-blue-700" },
                    { level: "advanced", color: "bg-purple-100 text-purple-700" }
                  ].map(({ level, color }) => (
                    <button key={level} onClick={() => setSelectedDifficulty(selectedDifficulty === level ? null : level)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm capitalize transition-all ${selectedDifficulty === level ? `${color} font-semibold shadow-sm` : "text-slate-600 hover:bg-slate-100"}`}>
                      {level}
                    </button>
                  ))}
                </div>
              </Card>

              <AnimatePresence>
                {activeFilters > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <Button variant="outline" className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => { setSearchQuery(""); setSelectedCategory(null); setSelectedDifficulty(null); }}>
                      <X className="w-4 h-4 mr-2" /> Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Courses Grid */}
          <div className="lg:col-span-3">
            {coursesQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">
                      Showing <span className="font-bold text-slate-900">{filteredCourses.length}</span> course{filteredCourses.length !== 1 ? "s" : ""}
                    </p>
                    {aiRecommendedIds.size > 0 && (
                      <p className="mt-1 text-xs font-medium text-violet-700 inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {aiRecommendedIds.size} smart picks highlighted first, including free and YouTube-friendly options
                      </p>
                    )}
                  </div>
                </motion.div>

                {filteredCourses.length > 0 ? (
                  <>
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <AnimatePresence mode="popLayout">
                        {filteredCourses.map((course) => (
                        <motion.div key={course.id} variants={cardVariants} layout exit={{ opacity: 0, scale: 0.9 }}>
                          <Card className="overflow-hidden card-hover cursor-pointer border-slate-200/80 bg-white/70 backdrop-blur-sm group"
                            onClick={() => navigate(`/course/${course.id}`)}>
                            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/80">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 flex-1 text-lg">{course.title}</h3>
                                <div className="flex items-center gap-2 ml-2">
                                  {aiRecommendedIds.has(course.id) && (
                                    <span className="px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap bg-violet-100 text-violet-700 inline-flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" /> AI
                                    </span>
                                  )}
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${course.difficulty === "beginner" ? "bg-emerald-100 text-emerald-700" :
                                    course.difficulty === "intermediate" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                    }`}>{course.difficulty}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${PLATFORM_COLORS[course.platform || ""] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                  {course.platform}
                                </span>
                                <span className="text-sm text-slate-500">{course.category}</span>
                                <span className="text-sm font-semibold text-emerald-600 ml-auto">{course.platformPrice}</span>
                              </div>
                            </div>
                            <div className="p-6">
                              <p className="text-sm text-slate-600 mb-4 line-clamp-2 leading-relaxed">{course.description}</p>
                              <div className="flex items-center justify-between mb-4 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" /><span>{Math.round((course.duration || 0) / 60)}h</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                  <span className="font-semibold text-slate-700">{((course.rating || 0) / 100).toFixed(1)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  <span>{((course.learnerCount || 0) / 1000).toFixed(0)}K</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-slate-500">By <span className="font-semibold text-slate-700">{course.instructor}</span></p>
                                <button
                                  onClick={(e) => handleToggleBookmark(course.id, e)}
                                  className={`p-2 rounded-lg transition-colors ${bookmarkedIds.has(course.id) ? "text-blue-600 bg-blue-50 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
                                  title={bookmarkedIds.has(course.id) ? "Remove from saved" : "Save to my list"}
                                >
                                  {bookmarkedIds.has(course.id) ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                                </button>
                              </div>
                              <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/15 group-hover:shadow-lg transition-all">
                                Compare & View <ExternalLink className="w-4 h-4 ml-2" />
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>

                    {canLoadMore && (
                      <div className="mt-8 flex justify-center">
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => setVisibleLimit((current) => Math.min(MAX_VISIBLE_COURSES, current + 24))}
                        >
                          Load More Courses
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <Card className="p-16 text-center border-slate-200/80 bg-white/60 backdrop-blur-sm">
                      <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-lg text-slate-600 mb-4">No courses match your filters</p>
                      <Button variant="outline" className="rounded-xl"
                        onClick={() => { setSearchQuery(""); setSelectedCategory(null); setSelectedDifficulty(null); }}>Clear All Filters</Button>
                    </Card>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* AI Chat Assistant */}
      <ChatBox />
    </div>
  );
}
