import AdminLayout from "@/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { toast } from "sonner";

const tabs = ["Overview", "Learning Paths", "Progress", "Interactions", "Login History"] as const;

export default function AdminUserDetail() {
  const [, params] = useRoute("/admin/users/:userId");
  const userId = Number(params?.userId ?? 0);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");

  const detailQuery = trpc.admin.getUserDetail.useQuery({ userId }, { enabled: userId > 0 });
  const banMutation = trpc.admin.banUser.useMutation();
  const unbanMutation = trpc.admin.unbanUser.useMutation();
  const resetMutation = trpc.admin.adminResetUserPassword.useMutation();
  const deleteMutation = trpc.admin.deleteUser.useMutation();

  const user = detailQuery.data?.user as any;
  const profile = (detailQuery.data?.profile ?? {}) as {
    skills?: string;
    interests?: string;
    learningGoals?: string;
    preferredDifficulty?: string;
    learningStyle?: string;
    bio?: string;
  };
  const initials = useMemo(() => {
    const name = user?.name || user?.email || "?";
    return name
      .split(" ")
      .map((p: string) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user]);

  const handleBanToggle = async () => {
    if (!user) return;
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
    await detailQuery.refetch();
  };

  const handleReset = async () => {
    if (!user) return;
    const newPassword = window.prompt("New password for this user:");
    if (!newPassword) return;
    await resetMutation.mutateAsync({ userId: user.id, newPassword });
    toast.success("Password reset");
  };

  const handleDelete = async () => {
    if (!user) return;
    const confirmed = window.confirm("Delete this user permanently?");
    if (!confirmed) return;
    await deleteMutation.mutateAsync({ userId: user.id });
    toast.success("User deleted");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-200 font-semibold">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{user?.name || "User"}</h1>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
            <span className="ml-4 inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
              {user?.role}
            </span>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${
              user?.isBanned ? "bg-red-500/20 text-red-200" : "bg-emerald-500/20 text-emerald-200"
            }`}>
              {user?.isBanned ? "Banned" : "Active"}
            </span>
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={handleReset}>Reset Password</Button>
            <Button variant="outline" onClick={handleBanToggle}>{user?.isBanned ? "Unban" : "Ban"}</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete User</Button>
          </div>
        </div>

        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`rounded-full px-4 py-2 text-sm ${
                activeTab === tab ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-900 text-slate-400"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Overview" && (
          <Card className="bg-slate-900/70 border-slate-800 p-6">
            <p className="text-sm text-slate-400 mb-4">Profile overview</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Skills</p>
                <p className="text-sm text-slate-200">{profile.skills || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Interests</p>
                <p className="text-sm text-slate-200">{profile.interests || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Learning Goals</p>
                <p className="text-sm text-slate-200">{profile.learningGoals || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Preferred Difficulty</p>
                <p className="text-sm text-slate-200">{profile.preferredDifficulty || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Learning Style</p>
                <p className="text-sm text-slate-200">{profile.learningStyle || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Bio</p>
                <p className="text-sm text-slate-200">{profile.bio || "-"}</p>
              </div>
            </div>
          </Card>
        )}

        {activeTab === "Learning Paths" && (
          <Card className="bg-slate-900/70 border-slate-800 p-6">
            <div className="space-y-3">
              {detailQuery.data?.learningPaths?.map((path: any) => (
                <div key={path.id} className="rounded-xl border border-slate-800 p-4">
                  <p className="font-semibold">{path.pathName}</p>
                  <p className="text-sm text-slate-400">{path.description}</p>
                  <p className="text-xs text-slate-500 mt-2">Status: {path.status}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === "Progress" && (
          <Card className="bg-slate-900/70 border-slate-800 p-6">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left">Course</th>
                  <th>Completion</th>
                  <th>Status</th>
                  <th>Time Spent</th>
                </tr>
              </thead>
              <tbody>
                {detailQuery.data?.progress?.map((row: any) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="py-2">{row.courseTitle || row.courseId}</td>
                    <td className="text-center">{row.completionPercentage}%</td>
                    <td className="text-center">{row.status}</td>
                    <td className="text-center">{row.totalTimeSpent} mins</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {activeTab === "Interactions" && (
          <Card className="bg-slate-900/70 border-slate-800 p-6">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left">Course</th>
                  <th>Type</th>
                  <th>Rating</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {detailQuery.data?.interactions?.map((row: any) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="py-2">{row.courseTitle || row.courseId}</td>
                    <td>{row.interactionType}</td>
                    <td>{row.rating ?? "-"}</td>
                    <td>{new Date(row.timestamp * 1000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {activeTab === "Login History" && (
          <Card className="bg-slate-900/70 border-slate-800 p-6">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left">IP</th>
                  <th>Timestamp</th>
                  <th>Success</th>
                </tr>
              </thead>
              <tbody>
                {detailQuery.data?.loginHistory?.map((row: any) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="py-2">{row.ipAddress || "-"}</td>
                    <td>{new Date(row.loginAt * 1000).toLocaleString()}</td>
                    <td>
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        row.success ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"
                      }`}>
                        {row.success ? "Success" : "Fail"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
