import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Activity,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Courses", href: "/admin/courses", icon: BookOpen },
  { label: "Activity Log", href: "/admin/activity-log", icon: Activity },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "admin") {
      navigate("/admin/login");
    }
  }, [loading, navigate, user]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-4">
          Loading admin console...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 flex bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_#0b1020_0%,_#0a1224_55%,_#0b0f1a_100%)]">
      <aside className="hidden md:flex md:w-72 flex-col border-r border-amber-300/20 bg-gradient-to-b from-[#0b1326] via-[#0a1122] to-[#0b0f1a]">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-emerald-500/20">
          <div className="h-10 w-10 rounded-xl bg-amber-300/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-amber-200" />
          </div>
          <div>
            <p className="text-lg font-semibold">Admin Console</p>
            <p className="text-xs text-amber-200/90">Secure oversight</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  isActive
                    ? "bg-amber-400/20 text-amber-100 border border-amber-300/50 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                    : "text-slate-300 hover:bg-amber-400/10 hover:text-amber-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 pb-6">
          <div className="rounded-2xl border border-amber-300/20 bg-[#0b1220]/80 px-4 py-4">
            <p className="text-sm font-semibold">{user.name || "Admin"}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-200">
                {user.role}
              </span>
              <span>{user.email}</span>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full border-amber-300/60 text-amber-100 hover:bg-amber-400/20 admin-btn"
              onClick={async () => {
                await logout();
                navigate("/admin/login");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">
        <div className="md:hidden border-b border-amber-300/20 px-4 py-4 bg-[#0b1220]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Admin Console</div>
            <Button size="sm" variant="outline" className="border-amber-300/60 text-amber-100 hover:bg-amber-400/10 admin-btn" onClick={() => navigate("/admin/dashboard")}> 
              Dashboard
            </Button>
          </div>
        </div>
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
