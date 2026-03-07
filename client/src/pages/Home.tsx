import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { ArrowRight, BookOpen, Sparkles, Users, TrendingUp, Zap, GraduationCap, Brain, Trophy, ChevronDown } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Animated counter hook
function useCounter(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return { count, ref };
}

// Floating particles
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            width: `${Math.random() * 6 + 3}px`,
            height: `${Math.random() * 6 + 3}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100 + 50}%`,
            background: `rgba(${99 + Math.random() * 100}, ${102 + Math.random() * 80}, 241, ${0.15 + Math.random() * 0.2})`,
            animationDuration: `${8 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 8}s`,
          }}
        />
      ))}
    </div>
  );
}

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1, scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const stats = [
    { end: 20, suffix: "+", label: "Courses Indexed" },
    { end: 6, suffix: "", label: "Platforms Tracked" },
    { end: 4, suffix: " Algorithms", label: "ML Models" },
    { end: 12, suffix: "+", label: "Cross-Platform Comparisons" },
  ];

  const features = [
    { icon: Sparkles, title: "Intelligent Recommendations", description: "Our AI analyzes your profile and recommends the best courses from all platforms.", color: "from-blue-500 to-cyan-500" },
    { icon: Brain, title: "Cross-Platform Comparison", description: "Compare the same course across Udemy, Coursera, edX and more — ratings, reviews, and prices.", color: "from-violet-500 to-purple-500" },
    { icon: TrendingUp, title: "Real-Time Ratings", description: "Aggregated ratings from multiple platforms, updated regularly for accuracy.", color: "from-emerald-500 to-teal-500" },
    { icon: Zap, title: "Unbiased Analysis", description: "No sponsored results. We rank purely by quality, reviews, and relevance to your goals.", color: "from-amber-500 to-orange-500" },
    { icon: GraduationCap, title: "Save & Compare", description: "Bookmark courses and compare them side-by-side before committing.", color: "from-pink-500 to-rose-500" },
    { icon: Trophy, title: "Free & Open", description: "100% free to use. We help you find the best course, wherever it lives.", color: "from-indigo-500 to-blue-500" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-x-hidden">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="sticky top-0 z-50 glass border-b border-white/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <motion.div
            className="flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/")}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">EduAI</span>
          </motion.div>
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" onClick={() => navigate("/courses")} className="font-medium">
                Courses
              </Button>
            </motion.div>
            {isAuthenticated ? (
              <>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" onClick={() => navigate("/dashboard")} className="rounded-xl">
                    Dashboard
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button onClick={() => navigate("/dashboard")} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
                    {user?.name || "Profile"}
                  </Button>
                </motion.div>
              </>
            ) : (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button onClick={() => navigate("/auth")} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
                  Sign In
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-[85vh] flex items-center overflow-hidden">
        <Particles />
        {/* Decorative blobs */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-indigo-400/15 rounded-full blur-3xl animate-float-delay" />
        <div className="absolute top-40 left-1/3 w-48 h-48 bg-purple-400/10 rounded-full blur-3xl animate-float" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <motion.div variants={itemVariants} className="inline-flex items-center gap-2 bg-blue-100/80 backdrop-blur-sm text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-blue-200/50">
                <Sparkles className="w-4 h-4" />
                AI Course Recommendation Engine
              </motion.div>

              <motion.h1 variants={itemVariants} className="text-5xl lg:text-7xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
                Find the Best Course,{" "}
                <span className="gradient-text">Anywhere.</span>
              </motion.h1>

              <motion.p variants={itemVariants} className="text-xl text-slate-600 mb-10 leading-relaxed max-w-lg">
                Compare courses across Udemy, Coursera, edX & more. Our AI recommends the perfect course based on ratings, reviews, and your learning goals.
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="lg"
                    onClick={() => navigate("/courses")}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl px-8 py-6 text-lg shadow-xl shadow-blue-500/25 animate-pulse-glow"
                  >
                    Get Started <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" variant="outline" onClick={() => navigate("/courses")} className="rounded-xl px-8 py-6 text-lg border-2">
                    Explore Courses
                  </Button>
                </motion.div>
              </motion.div>

              <motion.div variants={itemVariants} className="flex items-center gap-6 mt-10">
                <div className="flex -space-x-3">
                  {["bg-blue-500", "bg-indigo-500", "bg-purple-500", "bg-pink-500"].map((bg, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full ${bg} border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-bold text-slate-900">20+</span> real courses from Udemy, Coursera, edX & more
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 80, rotateY: 15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="relative hidden lg:block"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl blur-3xl opacity-20 animate-float-slow" />
              <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
                <div className="space-y-4">
                  {[
                    { icon: Sparkles, text: "Content-Based Filtering", bg: "bg-blue-50", iconColor: "text-blue-600", progress: 100 },
                    { icon: TrendingUp, text: "Collaborative Filtering", bg: "bg-emerald-50", iconColor: "text-emerald-600", progress: 100 },
                    { icon: Users, text: "Hybrid ML Recommendations", bg: "bg-purple-50", iconColor: "text-purple-600", progress: 100 },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.15 }}
                      className={`flex items-center gap-4 p-4 ${item.bg} rounded-2xl`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center`}>
                        <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-700">{item.text}</span>
                        <div className="w-full bg-white/80 rounded-full h-1.5 mt-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            transition={{ delay: 1 + i * 0.2, duration: 1, ease: "easeOut" }}
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full"
                          />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-500">{item.progress}%</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-400"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">Features</span>
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Why Choose EduAI?</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">Everything you need to accelerate your learning journey with cutting-edge AI</p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div key={idx} variants={scaleIn}>
                <Card className="p-8 card-hover border-slate-200/80 bg-white/60 backdrop-blur-sm h-full group">
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white"
          >
            {stats.map((stat, idx) => {
              const { count, ref } = useCounter(stat.end, 2000);
              return (
                <motion.div
                  key={idx}
                  ref={ref}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, type: "spring", stiffness: 200 }}
                >
                  <div className="text-5xl font-bold mb-2">
                    {count}{stat.suffix}
                  </div>
                  <p className="text-blue-100 font-medium">{stat.label}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-16 text-center text-white overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl lg:text-5xl font-bold mb-6"
            >
              Ready to Transform Your Learning?
            </motion.h2>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
              Compare real courses across 6 platforms, get AI recommendations tailored to your goals, and find the best course — free.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                onClick={() => navigate("/courses")}
                className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl px-10 py-6 text-lg font-semibold shadow-xl"
              >
                Start Learning Today <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-white text-lg">EduAI</span>
              </div>
              <p className="text-sm leading-relaxed">Personalized learning powered by artificial intelligence. Learn at your own pace, guided by AI.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Browse by Category</h4>
              <ul className="space-y-2.5 text-sm">
                <li><a href="/courses" className="hover:text-white transition-colors">Web Development</a></li>
                <li><a href="/courses" className="hover:text-white transition-colors">Data Science & Analytics</a></li>
                <li><a href="/courses" className="hover:text-white transition-colors">Machine Learning & AI</a></li>
                <li><a href="/courses" className="hover:text-white transition-colors">Cloud & DevOps</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Platforms Tracked</h4>
              <ul className="space-y-2.5 text-sm">
                <li><a href="https://www.udemy.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Udemy</a></li>
                <li><a href="https://www.coursera.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Coursera</a></li>
                <li><a href="https://www.edx.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">edX</a></li>
                <li><a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">YouTube</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Quick Links</h4>
              <ul className="space-y-2.5 text-sm">
                <li><a href="/courses" className="hover:text-white transition-colors">Explore Courses</a></li>
                <li><a href="/auth" className="hover:text-white transition-colors">Sign In / Register</a></li>
                <li><a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>&copy; 2026 EduAI. All rights reserved. Built with ❤️ and AI.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
