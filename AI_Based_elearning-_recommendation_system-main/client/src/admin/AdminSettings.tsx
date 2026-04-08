import AdminLayout from "@/admin/AdminLayout";
import { Card } from "@/components/ui/card";

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Settings</p>
          <h1 className="text-3xl font-semibold mt-2">System settings</h1>
        </div>

        <Card className="admin-card p-6">
          <p className="text-sm text-slate-300">Admin settings can be configured here.</p>
          <p className="text-sm text-slate-500 mt-2">Add notification preferences, API keys, or platform policies in future iterations.</p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-amber-300/20 bg-[#0a0f1c] p-4 admin-btn">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Alerts</p>
              <p className="text-sm text-slate-300 mt-2">Toggle anomaly alerts and threshold monitors.</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-[#0a0f1c] p-4 admin-btn">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">API access</p>
              <p className="text-sm text-slate-300 mt-2">Manage API keys for internal tools.</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-[#0a0f1c] p-4 admin-btn">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Policies</p>
              <p className="text-sm text-slate-300 mt-2">Review moderation and retention rules.</p>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
