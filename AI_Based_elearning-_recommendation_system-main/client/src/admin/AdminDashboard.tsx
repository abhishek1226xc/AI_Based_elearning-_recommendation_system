import AdminLayout from "@/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AdminDashboard() {
  const statsQuery = trpc.admin.getAdminDashboardStats.useQuery();
  const activityQuery = trpc.admin.getAdminActivityLog.useQuery({ page: 1, limit: 10 });
  const systemQuery = trpc.admin.getSystemStats.useQuery();

  const stats = statsQuery.data;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Overview</p>
          <h1 className="text-3xl font-semibold mt-2">Admin Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {[
            { label: "Total Users", value: stats?.totalUsers ?? 0 },
            { label: "Active Users", value: stats?.activeUsers ?? 0 },
            { label: "Banned Users", value: stats?.bannedUsers ?? 0 },
            { label: "Total Courses", value: stats?.totalCourses ?? 0 },
            { label: "Total Interactions", value: stats?.totalInteractions ?? 0 },
          ].map((item) => (
            <Card key={item.label} className="admin-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">{item.label}</p>
              <p className="text-2xl font-semibold mt-2 text-amber-50">{item.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="admin-card p-6 xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-amber-200/70">Top categories</p>
                <p className="text-lg font-semibold">Learning demand</p>
              </div>
              <div className="text-sm text-slate-300">
                New users this week: <span className="text-amber-200">{stats?.newUsersThisWeek ?? 0}</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.topCategories ?? []}>
                  <XAxis dataKey="category" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                  <Bar dataKey="count" fill="#34d399" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="admin-card p-6">
            <p className="text-sm text-amber-200/70">System signals</p>
            <p className="text-lg font-semibold mb-4">Operational highlights</p>
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-300/20 bg-[#0a0f1c] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Database size</p>
                <p className="text-lg text-amber-50">
                  {systemQuery.data?.dbSize ? `${(systemQuery.data.dbSize / 1024 / 1024).toFixed(2)} MB` : "-"}
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-[#0a0f1c] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Top bookmarks</p>
                <div className="mt-2 space-y-2 text-sm text-slate-300">
                  {systemQuery.data?.topBookmarked?.length ? systemQuery.data.topBookmarked.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-slate-200">{item.title}</span>
                      <span className="text-amber-200">{item.count}</span>
                    </div>
                  )) : (
                    <p className="text-slate-500">No bookmarks yet.</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="admin-card p-6">
          <p className="text-sm text-amber-200/70">Recent admin activity</p>
          <p className="text-lg font-semibold mb-4">Latest actions</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activityQuery.data?.items?.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-amber-300/20 bg-[#0a0f1c] px-4 py-3">
                <p className="text-sm font-semibold text-slate-200">{item.action}</p>
                <p className="text-xs text-slate-500">{item.adminName || "Admin"}</p>
              </div>
            ))}
            {activityQuery.data?.items?.length === 0 && (
              <p className="text-sm text-slate-500">No activity yet.</p>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
