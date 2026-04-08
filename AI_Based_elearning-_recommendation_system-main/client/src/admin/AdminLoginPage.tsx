import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ShieldAlert, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = trpc.auth.adminLogin.useMutation();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await loginMutation.mutateAsync({ email, password });
      toast.success("Welcome back, admin.");
      navigate("/admin/dashboard");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to login";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <Card className="w-full max-w-md bg-slate-900/80 border border-slate-800 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-red-300" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-red-300">Admin Portal</p>
            <h1 className="text-2xl font-semibold">Secure sign-in</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300">Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-700"
                placeholder="admin@elearning.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-300">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-700"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
