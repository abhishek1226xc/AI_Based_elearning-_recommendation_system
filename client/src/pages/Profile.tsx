import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  BookOpen,
  LogOut,
  User,
  Save,
  Plus,
  X,
  Loader2,
  GraduationCap,
  Brain,
  Target,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, type Variants, type Easing } from "framer-motion";
import { toast } from "sonner";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as Easing },
  },
};

const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
const LEARNING_STYLE_OPTIONS = [
  "visual",
  "reading",
  "hands-on",
  "auditory",
] as const;

function TagInput({
  label,
  tags,
  placeholder,
  onChange,
}: {
  label: string;
  tags: string[];
  placeholder: string;
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <p className="text-sm font-medium text-slate-300 mb-2">{label}</p>
      <div className="flex gap-2 mb-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="bg-slate-800/50 border-purple-500/30 text-white placeholder:text-slate-500 rounded-xl"
        />
        <Button
          type="button"
          size="sm"
          onClick={addTag}
          className="rounded-xl bg-purple-600 hover:bg-purple-700 px-3"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-900/50 border border-purple-500/40 text-purple-200 text-sm"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-purple-400 hover:text-red-400 transition-colors ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function safeParseJson(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Profile() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.get.useQuery();
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      toast.success("Profile updated! 🎉");
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [preferredDifficulty, setPreferredDifficulty] = useState<
    "beginner" | "intermediate" | "advanced"
  >("beginner");
  const [learningStyle, setLearningStyle] = useState("");

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    setBio(p.bio || "");
    setSkills(safeParseJson(p.skills));
    setInterests(safeParseJson(p.interests));
    setLearningGoals(safeParseJson(p.learningGoals));
    setPreferredDifficulty(
      (p.preferredDifficulty as "beginner" | "intermediate" | "advanced") ||
        "beginner"
    );
    setLearningStyle(p.learningStyle || "");
  }, [profileQuery.data]);

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      bio,
      skills,
      interests,
      learningGoals,
      preferredDifficulty,
      learningStyle,
    });
  };

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-950">
      {/* Nav */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 glass border-b border-white/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <motion.div
            className="flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate("/")}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">EduAI</span>
          </motion.div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="font-medium text-slate-100 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/courses")}
              className="font-medium text-slate-100 hover:text-white"
            >
              Courses
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                navigate("/auth");
              }}
              className="rounded-xl text-red-300 border-red-600/50 hover:bg-red-900/50"
            >
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {initials}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{user?.name}</h1>
              <p className="text-purple-200 mt-1">{user?.email}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {profileQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Account info */}
            <motion.div variants={itemVariants}>
              <Card className="p-6 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" /> Account
                  Information
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-300">
                  <div>
                    <p className="text-slate-400 mb-1">Name</p>
                    <p className="font-semibold text-white">{user?.name}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Email</p>
                    <p className="font-semibold text-white">{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Member Since</p>
                    <p className="font-semibold text-white">
                      {new Date(
                        user?.createdAt || ""
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Role</p>
                    <p className="font-semibold text-white capitalize">
                      {user?.role || "user"}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Bio */}
            <motion.div variants={itemVariants}>
              <Card className="p-6 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" /> About You
                </h2>
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-2">
                    Bio
                  </p>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Tell us a bit about yourself and your learning goals..."
                    className="w-full rounded-xl bg-slate-800/50 border border-purple-500/30 text-white placeholder:text-slate-500 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </Card>
            </motion.div>

            {/* Learning Preferences */}
            <motion.div variants={itemVariants}>
              <Card className="p-6 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" /> Learning
                  Preferences
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-3">
                      Preferred Difficulty
                    </p>
                    <div className="flex flex-col gap-2">
                      {DIFFICULTY_OPTIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setPreferredDifficulty(d)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors text-left capitalize ${
                            preferredDifficulty === d
                              ? "bg-purple-600 border-purple-500 text-white"
                              : "bg-slate-800/50 border-purple-500/30 text-slate-300 hover:border-purple-500/60"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-3">
                      Learning Style
                    </p>
                    <div className="flex flex-col gap-2">
                      {LEARNING_STYLE_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setLearningStyle(learningStyle === s ? "" : s)
                          }
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors text-left capitalize ${
                            learningStyle === s
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "bg-slate-800/50 border-purple-500/30 text-slate-300 hover:border-purple-500/60"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Skills, Interests, Goals */}
            <motion.div variants={itemVariants}>
              <Card className="p-6 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-purple-400" /> Skills
                  &amp; Interests
                </h2>
                <div className="space-y-6">
                  <TagInput
                    label="Skills"
                    tags={skills}
                    placeholder="e.g. Python, React, Machine Learning"
                    onChange={setSkills}
                  />
                  <TagInput
                    label="Interests"
                    tags={interests}
                    placeholder="e.g. Web Development, Data Science, AI"
                    onChange={setInterests}
                  />
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-6 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" /> Learning Goals
                </h2>
                <TagInput
                  label="Your Goals"
                  tags={learningGoals}
                  placeholder="e.g. Get a job as a developer, Learn ML basics"
                  onChange={setLearningGoals}
                />
              </Card>
            </motion.div>

            {/* Save button */}
            <motion.div variants={itemVariants} className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-2.5 font-semibold text-white shadow-lg"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {updateMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
