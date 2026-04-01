import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, BookOpen, Clock, Star, Users, Sparkles, Loader2, ExternalLink, Award, Bookmark, BookmarkCheck, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const PLATFORM_COLORS: Record<string, string> = {
  "Udemy": "bg-purple-100 text-purple-700", "Coursera": "bg-blue-100 text-blue-700",
  "edX": "bg-red-100 text-red-700", "YouTube": "bg-rose-100 text-rose-700",
  "Pluralsight": "bg-pink-100 text-pink-700", "A Cloud Guru": "bg-orange-100 text-orange-700",
  "Khan Academy": "bg-green-100 text-green-700",
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const tagVariants = { hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };

export default function CourseDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/course/:id");
  const { isAuthenticated } = useAuth();
  const courseId = params?.id ? parseInt(params.id) : null;
  const [bookmarked, setBookmarked] = useState(false);

  if (!courseId) { navigate("/courses"); return null; }

  const utils = trpc.useUtils();
  const courseQuery = trpc.courses.getById.useQuery({ id: courseId });
  const platformRatingsQuery = trpc.courses.platformRatings.useQuery({ courseId });
  const relatedQuery = trpc.recommendations.relatedCourses.useQuery({ courseId, limit: 5 });
  const aiSuggestionsQuery = trpc.recommendations.aiSuggestions.useQuery({ courseId, limit: 6 }, { enabled: isAuthenticated });
  const bookmarksQuery = trpc.bookmarks.list.useQuery(undefined, { enabled: isAuthenticated });
  const bookmarkAddMutation = trpc.bookmarks.add.useMutation();
  const bookmarkRemoveMutation = trpc.bookmarks.remove.useMutation();
  const recordInteraction = trpc.enrollment.recordInteraction.useMutation();

  type BookmarkItem = NonNullable<typeof bookmarksQuery.data>[number];
  type PlatformRatingItem = NonNullable<typeof platformRatingsQuery.data>[number];
  type RelatedCourseItem = NonNullable<typeof relatedQuery.data>[number];

  // Check if already bookmarked
  useEffect(() => {
    if (bookmarksQuery.data) {
      const isAlreadyBookmarked = bookmarksQuery.data.some((b: BookmarkItem) => b.courseId === courseId);
      setBookmarked(isAlreadyBookmarked);
    }
  }, [bookmarksQuery.data, courseId]);

  // Record view interaction
  useEffect(() => {
    if (isAuthenticated && courseId) {
      recordInteraction.mutate({ courseId, interactionType: "viewed" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, isAuthenticated]);

  const handleBookmark = async () => {
    if (!isAuthenticated) { navigate("/auth"); return; }
    try {
      if (bookmarked) {
        await bookmarkRemoveMutation.mutateAsync({ courseId });
        setBookmarked(false);
        toast.success("Removed from your list");
      } else {
        await bookmarkAddMutation.mutateAsync({ courseId });
        setBookmarked(true);
        toast.success("Saved to your list! 🔖");
      }
      // Invalidate so Dashboard updates
      await utils.bookmarks.list.invalidate();
    } catch { toast.error("Failed to update bookmark"); }
  };

  if (courseQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading course...</p>
        </motion.div>
      </div>
    );
  }

  if (!courseQuery.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <Card className="p-16 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4 text-lg">Course not found</p>
            <Button onClick={() => navigate("/courses")} className="rounded-xl">Back to Courses</Button>
          </Card>
        </div>
      </div>
    );
  }

  const course = courseQuery.data;
  const tags = course.tags ? JSON.parse(course.tags) : [];
  const platformRatings = platformRatingsQuery.data || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Nav */}
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
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="rounded-xl">Dashboard</Button>
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Button variant="ghost" onClick={() => navigate("/courses")} className="mb-4 text-white/80 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Courses
            </Button>
          </motion.div>
          <div className="flex items-center gap-3 mb-3">
            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${PLATFORM_COLORS[course.platform || ""] || "bg-white/20 text-white"}`}>{course.platform}</span>
            <span className="text-blue-200 font-medium">{course.platformPrice}</span>
          </div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl lg:text-5xl font-bold mb-3">{course.title}</motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-blue-100 text-lg">By {course.instructor}</motion.p>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Stats */}
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <Card className="p-6 mb-8 border-slate-200/80 bg-white/70 backdrop-blur-sm -mt-8 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { icon: Clock, label: "Duration", value: `${Math.round((course.duration || 0) / 60)}h`, color: "text-blue-600" },
                    { icon: Award, label: "Level", value: course.difficulty, color: "text-emerald-600", badge: true },
                    { icon: Star, label: "Rating", value: ((course.rating || 0) / 100).toFixed(1), color: "text-amber-500", star: true },
                    { icon: Users, label: "Learners", value: `${((course.learnerCount || 0) / 1000).toFixed(0)}K`, color: "text-indigo-600" },
                  ].map((s, i) => (
                    <motion.div key={i} variants={itemVariants} className="text-center">
                      <s.icon className={`w-6 h-6 ${s.color} mx-auto mb-2`} />
                      <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                      {s.badge ? (
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${s.value === "beginner" ? "bg-emerald-100 text-emerald-700" :
                          s.value === "intermediate" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>{s.value}</span>
                      ) : s.star ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="font-bold text-slate-900 text-lg">{s.value}</span>
                        </div>
                      ) : <p className="font-bold text-slate-900 text-lg">{s.value}</p>}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* About */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Card className="p-8 mb-8 border-slate-200/80 bg-white/70 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">About This Course</h2>
                <p className="text-slate-600 leading-relaxed mb-6 text-lg">{course.description}</p>
                {tags.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-900 mb-3">Topics Covered</h3>
                    <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex flex-wrap gap-2">
                      {tags.map((tag: string) => (
                        <motion.span key={tag} variants={tagVariants} className="px-4 py-1.5 bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">{tag}</motion.span>
                      ))}
                    </motion.div>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Cross-Platform Comparison */}
            {platformRatings.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Globe className="w-6 h-6 text-blue-600" />
                  Cross-Platform Comparison
                </h2>
                <Card className="mb-8 border-slate-200/80 bg-white/70 backdrop-blur-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Platform</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Rating</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Reviews</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Main platform first */}
                        <tr className="bg-blue-50/40">
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${PLATFORM_COLORS[course.platform || ""] || "bg-slate-100 text-slate-700"}`}>
                              {course.platform} ★
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                              <span className="font-bold text-slate-900">{((course.platformRating || 0) / 100).toFixed(1)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-sm font-medium text-slate-700">{(course.reviewCount || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-center"><span className="font-semibold text-emerald-600">{course.platformPrice}</span></td>
                          <td className="px-6 py-4 text-right">
                            <a href={course.platformUrl || "#"} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
                                Go <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            </a>
                          </td>
                        </tr>
                        {/* Other platforms */}
                        {platformRatings.map((pr: PlatformRatingItem) => (
                          <tr key={pr.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${PLATFORM_COLORS[pr.platform] || "bg-slate-100 text-slate-700"}`}>
                                {pr.platform}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                <span className="font-bold text-slate-900">{((pr.rating || 0) / 100).toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center text-sm font-medium text-slate-700">{(pr.reviewCount || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-center"><span className="font-semibold text-emerald-600">{pr.price}</span></td>
                            <td className="px-6 py-4 text-right">
                              <a href={pr.url || "#"} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="rounded-xl">
                                  Go <ExternalLink className="w-3 h-3 ml-1" />
                                </Button>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Related */}
            {relatedQuery.data && relatedQuery.data.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Courses</h2>
                <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  {relatedQuery.data.map((rec: RelatedCourseItem) => (
                    <motion.div key={rec.courseId} variants={itemVariants}>
                      <Card className="p-5 border-slate-200/80 bg-white/70 card-hover cursor-pointer group" onClick={() => navigate(`/course/${rec.courseId}`)}>
                        <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{rec.reason}</h3>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-indigo-600">{Math.round(rec.score * 100)}% match</span>
                          <Button size="sm" variant="ghost" className="text-blue-600">View <ExternalLink className="w-3 h-3 ml-1" /></Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-1">
            <Card className="p-8 sticky top-28 border-slate-200/80 bg-white/70 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Course Details</h3>
              <div className="space-y-3 text-sm text-slate-600 mb-6">
                <p><span className="font-semibold text-slate-900">Platform:</span> {course.platform}</p>
                <p><span className="font-semibold text-slate-900">Category:</span> {course.category}</p>
                <p><span className="font-semibold text-slate-900">Instructor:</span> {course.instructor}</p>
                <p><span className="font-semibold text-slate-900">Duration:</span> {Math.round((course.duration || 0) / 60)} hours</p>
                <p><span className="font-semibold text-slate-900">Level:</span> <span className="capitalize">{course.difficulty}</span></p>
                <p><span className="font-semibold text-slate-900">Price:</span> <span className="text-emerald-600 font-semibold">{course.platformPrice}</span></p>
                <p><span className="font-semibold text-slate-900">Reviews:</span> {(course.reviewCount || 0).toLocaleString()}</p>
              </div>

              <div className="border-t border-slate-200 pt-6 space-y-3">
                <a href={course.platformUrl || "#"} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl py-6 text-lg shadow-lg shadow-blue-500/25 animate-pulse-glow">
                    Go to Course <ExternalLink className="w-5 h-5 ml-2" />
                  </Button>
                </a>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className={`w-full rounded-xl ${bookmarked ? "border-emerald-300 bg-emerald-50 hover:bg-red-50 hover:border-red-300" : ""}`}
                    onClick={handleBookmark}
                    disabled={bookmarkAddMutation.isPending || bookmarkRemoveMutation.isPending}
                  >
                    {bookmarked ? <><BookmarkCheck className="w-4 h-4 mr-2 text-emerald-600" /> Saved — Click to Remove</> : <><Bookmark className="w-4 h-4 mr-2" /> Save to My List</>}
                  </Button>
                </motion.div>
              </div>

              <div className="border-t border-slate-200 mt-6 pt-6">
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600" /> Why We Recommend This
                </h4>
                <ul className="space-y-2.5 text-sm text-slate-600">
                  {[
                    `${((course.rating || 0) / 100).toFixed(1)}★ rating from ${(course.reviewCount || 0).toLocaleString()} reviews`,
                    `${((course.learnerCount || 0) / 1000).toFixed(0)}K+ learners across platforms`,
                    platformRatings.length > 0 ? `Compared across ${platformRatings.length + 1} platforms` : "Top-rated in its category",
                    `${course.completionRate}% completion rate`,
                  ].map((item, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }} className="flex gap-2">
                      <span className="text-blue-600 font-bold mt-0.5">✦</span><span>{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
