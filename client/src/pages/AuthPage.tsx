import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { BookOpen, Mail, Lock, User, ArrowRight, Loader2, Sparkles, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function AuthPage() {
    const [, navigate] = useLocation();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);

    const utils = trpc.useUtils();
    const loginMutation = trpc.auth.login.useMutation();
    const registerMutation = trpc.auth.register.useMutation();
    const isLoading = loginMutation.isPending || registerMutation.isPending;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (mode === "login") {
                await loginMutation.mutateAsync({ email, password });
                toast.success("Welcome back! 👋");
            } else {
                await registerMutation.mutateAsync({ name, email, password });
                toast.success("Account created! 🎉");
            }
            await utils.auth.me.invalidate();
            navigate("/dashboard");
        } catch (error: any) {
            toast.error(error.message || "Something went wrong");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex">
            {/* Left: Branding */}
            <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 relative overflow-hidden"
            >
                <div className="absolute inset-0">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute rounded-full bg-white/10"
                            style={{
                                width: 8 + Math.random() * 40,
                                height: 8 + Math.random() * 40,
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animation: `float ${4 + Math.random() * 6}s ease-in-out infinite`,
                                animationDelay: `${Math.random() * 5}s`,
                            }}
                        />
                    ))}
                </div>
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                <BookOpen className="w-8 h-8" />
                            </div>
                            <span className="text-3xl font-bold">EduAI</span>
                        </div>
                        <h1 className="text-4xl font-bold mb-4 leading-tight">
                            Find the Best Course,<br />
                            <span className="bg-gradient-to-r from-cyan-300 to-amber-300 bg-clip-text text-transparent">Anywhere.</span>
                        </h1>
                        <p className="text-blue-100 text-lg mb-8 max-w-md">
                            AI-powered recommendations for 1000+ courses.
                            Compare ratings, reviews, and find your perfect match in one place.
                        </p>
                        <div className="grid grid-cols-2 gap-4 max-w-sm">
                            {[
                                { n: "1000+", l: "Courses Available" },
                                { n: "50+", l: "Learning Topics" },
                                { n: "4 ML", l: "Algorithms Used" },
                                { n: "100%", l: "Free to Use" },
                            ].map((s, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className="bg-white/10 rounded-xl p-3 backdrop-blur-sm"
                                >
                                    <p className="text-xl font-bold">{s.n}</p>
                                    <p className="text-blue-200 text-xs">{s.l}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* Right: Auth Form */}
            <div className="flex-1 flex items-center justify-center px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="w-full max-w-md"
                >
                    <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-slate-900">EduAI</span>
                    </div>

                    <Card className="p-8 border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-xl shadow-blue-500/5">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">
                                {mode === "login" ? "Welcome Back" : "Create Account"}
                            </h2>
                            <p className="text-slate-500 mt-1">
                                {mode === "login"
                                    ? "Sign in to your personalized recommendations"
                                    : "Start getting AI-powered course recommendations"}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <AnimatePresence mode="wait">
                                {mode === "register" && (
                                    <motion.div
                                        key="name"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            <Input
                                                placeholder="John Doe"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="pl-10 rounded-xl"
                                                required
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <Input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 rounded-xl"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <Input
                                        type={showPw ? "text" : "password"}
                                        placeholder={mode === "register" ? "Minimum 8 characters" : "Enter your password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 pr-10 rounded-xl"
                                        required
                                        minLength={mode === "register" ? 8 : 1}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(!showPw)}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl py-6 text-lg shadow-lg shadow-blue-500/25"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            {mode === "login" ? "Signing in..." : "Creating account..."}
                                        </>
                                    ) : (
                                        <>
                                            {mode === "login" ? "Sign In" : "Create Account"}
                                            <ArrowRight className="w-5 h-5 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-slate-500">
                                {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                                <button
                                    onClick={() => setMode(mode === "login" ? "register" : "login")}
                                    className="text-blue-600 font-semibold hover:underline"
                                >
                                    {mode === "login" ? "Sign Up" : "Sign In"}
                                </button>
                            </p>
                        </div>
                    </Card>

                    <p className="text-center text-xs text-slate-400 mt-6">
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        AI recommendations powered by content-based & collaborative filtering
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
