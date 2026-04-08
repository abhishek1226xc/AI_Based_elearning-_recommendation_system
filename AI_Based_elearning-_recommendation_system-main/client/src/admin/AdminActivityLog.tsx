import AdminLayout from "@/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export default function AdminActivityLog() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const logQuery = trpc.admin.getAdminActivityLog.useQuery({ page, limit: 10 });

  const filteredItems = useMemo(() => {
    if (!filter) return logQuery.data?.items ?? [];
    return (logQuery.data?.items ?? []).filter((item: any) => item.action === filter);
  }, [filter, logQuery.data?.items]);

  const exportCsv = () => {
    const rows = filteredItems ?? [];
    const header = ["Admin", "Action", "TargetUser", "Details", "Timestamp"].join(",");
    const lines = rows.map((item: any) => {
      const ts = item.performedAt ? new Date(item.performedAt * 1000).toISOString() : "";
      return [item.adminName || "Admin", item.action, item.targetUserId ?? "", item.details ?? "", ts]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-activity.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Admin Activity</p>
          <h1 className="text-3xl font-semibold mt-2">Audit log</h1>
        </div>

        <Card className="admin-card p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400">Filter by action</label>
            <select
              className="h-10 rounded-md border border-amber-300/20 bg-[#0a0f1c] text-sm text-slate-200 px-3"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="ban_user">ban_user</option>
              <option value="unban_user">unban_user</option>
              <option value="reset_password">reset_password</option>
              <option value="delete_user">delete_user</option>
              <option value="view_user">view_user</option>
            </select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn" onClick={() => logQuery.refetch()}>
                Refresh
              </Button>
              <Button variant="outline" className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        <Card className="admin-card p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-amber-100/70">
                <tr className="text-left">
                  <th className="py-2">Admin</th>
                  <th>Action</th>
                  <th>Target User</th>
                  <th>Details</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item: any) => (
                  <tr key={item.id} className="border-t border-amber-300/10">
                    <td className="py-3">{item.adminName || "Admin"}</td>
                    <td>{item.action}</td>
                    <td>{item.targetUserId ?? "-"}</td>
                    <td className="text-slate-400">{item.details || "-"}</td>
                    <td className="text-slate-400">
                      {item.performedAt ? new Date(item.performedAt * 1000).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">Total: {logQuery.data?.total ?? 0}</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn"
              disabled={Boolean(logQuery.data && page * 10 >= logQuery.data.total)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
