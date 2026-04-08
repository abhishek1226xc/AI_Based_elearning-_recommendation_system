import AdminLayout from "@/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function AdminUsers() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"user" | "admin" | "">("");
  const [status, setStatus] = useState<"active" | "banned" | "">("");
  const [page, setPage] = useState(1);

  const statsQuery = trpc.admin.getAdminDashboardStats.useQuery();
  const usersQuery = trpc.admin.getAllUsers.useQuery({
    page,
    limit: 10,
    search: search || undefined,
    role: role || undefined,
    status: status || undefined,
  });

  const banMutation = trpc.admin.banUser.useMutation();
  const unbanMutation = trpc.admin.unbanUser.useMutation();
  const resetMutation = trpc.admin.adminResetUserPassword.useMutation();
  const deleteMutation = trpc.admin.deleteUser.useMutation();

  const handleBanToggle = async (user: any) => {
    if (user.isBanned) {
      await unbanMutation.mutateAsync({ userId: user.id });
      toast.success("User unbanned");
    } else {
      const confirmed = window.confirm(`Ban ${user.name || user.email}?`);
      if (!confirmed) return;
      const reason = window.prompt("Reason for ban:", "Policy violation") || "Policy violation";
      await banMutation.mutateAsync({ userId: user.id, reason });
      toast.success("User banned");
    }
    await usersQuery.refetch();
  };

  const handleReset = async (user: any) => {
    const newPassword = window.prompt("New password for this user:");
    if (!newPassword) return;
    await resetMutation.mutateAsync({ userId: user.id, newPassword });
    toast.success("Password reset");
  };

  const handleDelete = async (user: any) => {
    const confirmed = window.confirm(`Delete ${user.name || user.email}? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync({ userId: user.id });
    toast.success("User deleted");
    await usersQuery.refetch();
  };

  const exportCsv = () => {
    const rows = usersQuery.data?.items ?? [];
    const header = ["Name", "Email", "Role", "Status", "LastLogin"].join(",");
    const lines = rows.map((user: any) => {
      const statusLabel = user.isBanned ? "Banned" : "Active";
      const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt * 1000).toISOString() : "";
      return [user.name || "", user.email || "", user.role || "", statusLabel, lastLogin]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-users.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    const total = statsQuery.data?.totalUsers ?? 0;
    const active = statsQuery.data?.activeUsers ?? 0;
    const banned = statsQuery.data?.bannedUsers ?? 0;
    return { total, active, banned };
  }, [statsQuery.data]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Users</p>
          <h1 className="text-3xl font-semibold mt-2">Manage learners</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total users", value: summary.total },
            { label: "Active users", value: summary.active },
            { label: "Banned users", value: summary.banned },
          ].map((card) => (
            <Card key={card.label} className="admin-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">{card.label}</p>
              <p className="text-2xl font-semibold mt-2 text-amber-50">{card.value}</p>
            </Card>
          ))}
        </div>

        <Card className="admin-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input
              placeholder="Search name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#0a0f1c] border-amber-300/20 text-slate-100"
            />
            <select
              className="h-10 rounded-md border border-amber-300/20 bg-[#0a0f1c] text-sm text-slate-200 px-3"
              value={role}
              onChange={(e) => setRole(e.target.value as "user" | "admin" | "")}
            >
              <option value="">All roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="h-10 rounded-md border border-amber-300/20 bg-[#0a0f1c] text-sm text-slate-200 px-3"
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "banned" | "")}
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
            <Button onClick={() => usersQuery.refetch()} className="bg-amber-400 text-slate-950 hover:bg-amber-300 admin-btn">
              Apply filters
            </Button>
            <Button variant="outline" onClick={exportCsv} className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn">
              Export CSV
            </Button>
          </div>
        </Card>

        <Card className="admin-card p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-amber-100/70">
                <tr className="text-left">
                  <th className="py-2">Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.items?.map((user: any) => (
                  <tr key={user.id} className="border-t border-amber-400/10">
                    <td className="py-3 font-medium text-slate-100">{user.name || "(no name)"}</td>
                    <td className="text-slate-300">{user.email}</td>
                    <td className="text-slate-300 capitalize">{user.role}</td>
                    <td>
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        user.isBanned ? "bg-rose-500/20 text-rose-200" : "bg-amber-400/20 text-amber-200"
                      }`}>
                        {user.isBanned ? "Banned" : "Active"}
                      </span>
                    </td>
                    <td className="text-slate-400">
                      {user.lastLoginAt ? new Date(user.lastLoginAt * 1000).toLocaleString() : "-"}
                    </td>
                    <td className="space-x-2">
                      <Button size="sm" className="bg-sky-400/90 text-slate-950 hover:bg-sky-300 admin-btn" onClick={() => navigate(`/admin/users/${user.id}`)}>
                        View
                      </Button>
                      <Button size="sm" className="bg-amber-300/90 text-slate-950 hover:bg-amber-200 admin-btn" onClick={() => handleBanToggle(user)}>
                        {user.isBanned ? "Unban" : "Ban"}
                      </Button>
                      <Button size="sm" className="bg-violet-400/90 text-slate-950 hover:bg-violet-300 admin-btn" onClick={() => handleReset(user)}>
                        Reset Password
                      </Button>
                      <Button size="sm" className="bg-rose-500 text-white hover:bg-rose-400 admin-btn" onClick={() => handleDelete(user)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">
            Total: {usersQuery.data?.total ?? 0}
          </span>
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
              disabled={Boolean(usersQuery.data && page * 10 >= usersQuery.data.total)}
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
