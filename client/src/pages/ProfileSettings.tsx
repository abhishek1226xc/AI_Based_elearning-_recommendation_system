import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, Save, Sparkles, UserCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function parseProfileArray(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter((item) => item.length > 0);
    }
  } catch {
    // Fall through to CSV parsing.
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toStringArray(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 25);
}

export default function ProfileSettings() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const updateProfileMutation = trpc.profile.update.useMutation();

  const [skillsInput, setSkillsInput] = useState("");
  const [interestsInput, setInterestsInput] = useState("");
  const [goalsInput, setGoalsInput] = useState("");
  const [preferredDifficulty, setPreferredDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [learningStyle, setLearningStyle] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;

    setSkillsInput(parseProfileArray(profile.skills).join(", "));
    setInterestsInput(parseProfileArray(profile.interests).join(", "));
    setGoalsInput(parseProfileArray(profile.learningGoals).join(", "));
    setPreferredDifficulty(
      profile.preferredDifficulty === "beginner" ||
      profile.preferredDifficulty === "intermediate" ||
      profile.preferredDifficulty === "advanced"
        ? profile.preferredDifficulty
        : "intermediate"
    );
    setLearningStyle(profile.learningStyle || "");
    setBio(profile.bio || "");
  }, [profileQuery.data]);

  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  const isOnboardingIncomplete = useMemo(() => {
    const profile = profileQuery.data;
    if (!profile) return true;

    return (
      parseProfileArray(profile.skills).length === 0 ||
      parseProfileArray(profile.interests).length === 0 ||
      parseProfileArray(profile.learningGoals).length === 0
    );
  }, [profileQuery.data]);

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        skills: toStringArray(skillsInput),
        interests: toStringArray(interestsInput),
        learningGoals: toStringArray(goalsInput),
        preferredDifficulty,
        learningStyle: learningStyle.trim() || undefined,
        bio: bio.trim() || undefined,
      });

      await Promise.all([
        utils.profile.get.invalidate(),
        utils.recommendations.getForUser.invalidate(),
      ]);
      toast.success("Profile saved. Recommendations will adapt to your preferences.");
    } catch {
      toast.error("Failed to save profile settings");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">EduAI</span>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card className="p-8 mb-6 border-slate-200/80 bg-white/70 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center">
              <UserCog className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Profile & Settings</h1>
              <p className="text-slate-600 mt-1">Configure your learning profile so recommendations improve over time.</p>
            </div>
          </div>
        </Card>

        {isOnboardingIncomplete && (
          <Card className="p-5 mb-6 border-amber-200 bg-amber-50/80">
            <p className="text-amber-900 font-semibold inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Onboarding survey incomplete
            </p>
            <p className="text-sm text-amber-800 mt-1">
              Add your skills, interests, and goals to improve cold-start recommendations.
            </p>
          </Card>
        )}

        <Card className="p-8 border-slate-200/80 bg-white/70 backdrop-blur-sm space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-800">Skills (comma separated)</label>
            <Input
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="React, TypeScript, Python, SQL"
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Interests (comma separated)</label>
            <Input
              value={interestsInput}
              onChange={(e) => setInterestsInput(e.target.value)}
              placeholder="Machine Learning, Web Development, Cloud"
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Learning Goals (comma separated)</label>
            <Input
              value={goalsInput}
              onChange={(e) => setGoalsInput(e.target.value)}
              placeholder="Get a backend job, build production apps"
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Preferred Difficulty</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPreferredDifficulty(level)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                    preferredDifficulty === level
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Learning Style</label>
            <Input
              value={learningStyle}
              onChange={(e) => setLearningStyle(e.target.value)}
              placeholder="Project-based, visual, text-first"
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Short Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Tell us what you are learning and why."
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updateProfileMutation.isPending}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateProfileMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
