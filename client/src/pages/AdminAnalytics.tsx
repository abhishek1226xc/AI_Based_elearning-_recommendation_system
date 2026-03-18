import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, ArrowLeft, BarChart3, BookOpen, Lightbulb, Loader2, MessageSquareText, RefreshCw, Users } from "lucide-react";
import { useLocation } from "wouter";

const METRIC_CARDS = [
  { key: "users", label: "Users", icon: Users, color: "from-blue-600 to-cyan-600" },
  { key: "courses", label: "Courses", icon: BookOpen, color: "from-indigo-600 to-violet-600" },
  { key: "interactions", label: "Interactions", icon: Activity, color: "from-emerald-600 to-teal-600" },
  { key: "recommendations", label: "Recommendations", icon: Lightbulb, color: "from-amber-600 to-orange-600" },
] as const;

export default function AdminAnalytics() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const analyticsQuery = trpc.admin.analytics.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchOnWindowFocus: false,
  });
  const analytics = analyticsQuery.data;
  const hasAnyData = Boolean(
    analytics &&
    (
      analytics.users > 0 ||
      analytics.courses > 0 ||
      analytics.interactions > 0 ||
      analytics.recommendations > 0 ||
      analytics.feedback > 0 ||
      analytics.topCategories.length > 0
    )
  );

  const lastUpdated = analyticsQuery.dataUpdatedAt
    ? new Date(analyticsQuery.dataUpdatedAt).toLocaleTimeString()
    : null;

  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
        <Card className="max-w-xl p-8 text-center border-slate-200/80 bg-white/80">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Admin Access Required</h1>
          <p className="text-slate-600 mb-5">This page is available only to admin users.</p>
          <Button className="rounded-xl" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">Admin Analytics</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-white/30 text-white hover:bg-white/10"
              onClick={() => analyticsQuery.refetch()}
              disabled={analyticsQuery.isFetching}
            >
              {analyticsQuery.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
            <Button variant="outline" className="rounded-xl border-white/30 text-white hover:bg-white/10" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <Card className="p-6 border-white/10 bg-slate-900/60 text-slate-100">
          <h1 className="text-3xl font-bold">Platform Health</h1>
          <p className="text-slate-300 mt-1">Live operational snapshot for recommendation and engagement metrics.</p>
          {lastUpdated && (
            <p className="text-xs text-slate-400 mt-2">Last updated: {lastUpdated}</p>
          )}
        </Card>

        {analyticsQuery.isLoading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {METRIC_CARDS.map((card) => (
                <Card key={card.key} className="p-5 border-white/10 bg-slate-900/60 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-slate-700 mb-3" />
                  <div className="h-4 w-24 bg-slate-700 rounded mb-3" />
                  <div className="h-8 w-20 bg-slate-700 rounded" />
                </Card>
              ))}
            </div>
            <Card className="p-6 border-white/10 bg-slate-900/60 text-slate-300 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading analytics...
            </Card>
          </>
        )}

        {analyticsQuery.isError && (
          <Card className="p-6 border-rose-400/40 bg-rose-900/30 text-rose-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-300" />
              <div>
                <p className="font-semibold">Unable to load admin analytics</p>
                <p className="text-sm text-rose-200 mt-1">{analyticsQuery.error?.message || "Please retry in a few seconds."}</p>
                <Button
                  className="mt-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => analyticsQuery.refetch()}
                  disabled={analyticsQuery.isFetching}
                >
                  {analyticsQuery.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Retry
                </Button>
              </div>
            </div>
          </Card>
        )}

        {!analyticsQuery.isLoading && !analyticsQuery.isError && analytics && !hasAnyData && (
          <Card className="p-8 border-white/10 bg-slate-900/60 text-center text-slate-200">
            <h2 className="text-xl font-semibold">No analytics data yet</h2>
            <p className="text-sm text-slate-400 mt-2">
              Generate recommendations, interact with courses, and collect feedback to populate this dashboard.
            </p>
            <Button className="mt-5 rounded-xl" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          </Card>
        )}

        {analytics && hasAnyData && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {METRIC_CARDS.map((card) => {
                const Icon = card.icon;
                const value = analytics[card.key];
                return (
                  <Card key={card.key} className="p-5 border-white/10 bg-slate-900/60">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-slate-300 text-sm">{card.label}</p>
                    <p className="text-3xl font-bold text-white mt-1">{value.toLocaleString()}</p>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="p-6 border-white/10 bg-slate-900/60">
                <h2 className="text-xl font-semibold mb-4 inline-flex items-center gap-2">
                  <MessageSquareText className="w-5 h-5 text-emerald-400" /> Recommendation Feedback
                </h2>
                <div className="space-y-3 text-sm text-slate-200">
                  <p>Total feedback events: <span className="font-bold">{analytics.feedback}</span></p>
                  <p>Helpful rate: <span className="font-bold text-emerald-300">{analytics.helpfulRate}%</span></p>
                  <p>Daily active users: <span className="font-bold">{analytics.dailyActiveUsers}</span></p>
                </div>
              </Card>

              <Card className="p-6 border-white/10 bg-slate-900/60">
                <h2 className="text-xl font-semibold mb-4 inline-flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-400" /> Top Course Categories
                </h2>
                <div className="space-y-3">
                  {analytics.topCategories.length > 0 ? (
                    analytics.topCategories.map((category) => (
                      <div key={category.category}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-200">{category.category}</span>
                          <span className="text-slate-300">{category.count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                            style={{ width: `${Math.min(100, (category.count / Math.max(1, analytics.courses)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No category data available.</p>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
