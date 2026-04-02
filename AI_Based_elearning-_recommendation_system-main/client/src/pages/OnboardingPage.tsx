import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildRoadmap,
  EXPERIENCE_OPTIONS,
  FIELD_OPTIONS,
  getEstimatedCompletionDate,
  LEARNING_STYLE_OPTIONS,
  readProfilePreferences,
  saveOnboardingData,
  type ExperienceLevel,
  type LearningStyle,
} from "@/lib/onboarding";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function OnboardingPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const stepLabels = ["Field", "Preferences", "Roadmap"];

  const [step, setStep] = useState(1);
  const [field, setField] = useState(FIELD_OPTIONS[0]);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("beginner");
  const [learningStyle, setLearningStyle] = useState<LearningStyle>("mixed");
  const [weeklyHours, setWeeklyHours] = useState(6);
  const [goal, setGoal] = useState("Get job-ready skills in 3 months");

  const roadmap = useMemo(
    () =>
      buildRoadmap({
        field,
        experienceLevel,
        weeklyHours,
        goal,
        learningStyle,
      }),
    [experienceLevel, field, goal, learningStyle, weeklyHours]
  );

  const roadmapFlow = useMemo(
    () =>
      roadmap.map((item, index) => ({
        id: index + 1,
        title: item,
        tone:
          index === 0
            ? "from-sky-500 to-cyan-500"
            : index === roadmap.length - 1
              ? "from-emerald-500 to-teal-500"
              : "from-indigo-500 to-violet-500",
      })),
    [roadmap]
  );

  const profileMutation = trpc.profile.update.useMutation();
  const refreshRecommendations = trpc.recommendations.refresh.useMutation();
  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!profileQuery.data) return;

    const profile = readProfilePreferences(profileQuery.data);
    if (profile.interests[0] && FIELD_OPTIONS.includes(profile.interests[0])) {
      setField(profile.interests[0]);
    }
    if (
      profile.preferredDifficulty &&
      EXPERIENCE_OPTIONS.some((option) => option.value === profile.preferredDifficulty)
    ) {
      setExperienceLevel(profile.preferredDifficulty as ExperienceLevel);
    }
    if (
      profile.learningStyle &&
      LEARNING_STYLE_OPTIONS.some((option) => option.value === profile.learningStyle)
    ) {
      setLearningStyle(profile.learningStyle as LearningStyle);
    }
    if (profile.goals[0]) {
      setGoal(profile.goals[0]);
    }
  }, [profileQuery.data]);

  const estimatedCompletionDate = useMemo(
    () => getEstimatedCompletionDate(weeklyHours),
    [weeklyHours]
  );

  if (!loading && !isAuthenticated) {
    navigate("/auth");
    return null;
  }

  const completeOnboarding = async () => {
    if (!user?.id) return;

    try {
      await profileMutation.mutateAsync({
        skills: [field],
        interests: [field],
        learningGoals: [goal],
        preferredDifficulty: experienceLevel,
        learningStyle,
        bio: `Learning ${field} with ${weeklyHours}h/week`,
        onboardingCompleted: true,
      });

      await refreshRecommendations.mutateAsync({ userId: user.id });

      saveOnboardingData({
        field,
        goal,
        weeklyHours,
        experienceLevel,
        learningStyle,
        roadmap,
        createdAt: new Date().toISOString(),
      });

      toast.success("Roadmap generated and recommendations are ready.");
      navigate("/recommendations");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to complete onboarding";
      toast.error(message);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef6ff_48%,_#eaf1ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="soft-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="pointer-events-none absolute -left-16 top-20 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-4 top-40 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />

      <div className="relative mx-auto max-w-5xl space-y-6">
        <Card className="surface-card p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Personalized learning flow</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Build your personalized learning journey</h1>
              <p className="mt-3 max-w-2xl text-slate-600">
                Sign-in is complete. We’ll capture your target field, refine the roadmap with your preferences, and then unlock course recommendations built around your path.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 shadow-sm">
              Step {step} of 3
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {stepLabels.map((label, index) => {
              const currentStep = index + 1;
              const isActive = currentStep === step;
              const isComplete = currentStep < step;

              return (
                <div
                  key={label}
                  className={`rounded-2xl border px-4 py-3 transition-all ${
                    isActive
                      ? "border-sky-300 bg-sky-50 text-sky-900 shadow-sm"
                      : isComplete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]">Step {currentStep}</p>
                  <p className="mt-1 font-medium">{label}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {step === 1 ? (
          <Card className="surface-card p-6 md:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Choose your field</h2>
            <p className="mb-4 mt-1 text-slate-600">Select the area you want to focus on first.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELD_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setField(option)}
                  className={`rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                    field === option
                      ? "border-sky-500 bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setStep(2)} className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 shadow-lg shadow-sky-500/20 hover:from-sky-700 hover:to-cyan-700">
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="surface-card p-6 md:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Additional questions</h2>
            <p className="mb-4 mt-1 text-slate-600">These answers tune your roadmap and recommendations.</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Experience level</span>
                <select
                  value={experienceLevel}
                  onChange={(event) => setExperienceLevel(event.target.value as ExperienceLevel)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  {EXPERIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Learning style</span>
                <select
                  value={learningStyle}
                  onChange={(event) => setLearningStyle(event.target.value as LearningStyle)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  {LEARNING_STYLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Hours per week</span>
                <Input
                  type="number"
                  min={1}
                  max={40}
                  value={weeklyHours}
                  onChange={(event) => setWeeklyHours(Number(event.target.value || 1))}
                  className="rounded-2xl"
                />
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Main goal</span>
                <Input value={goal} onChange={(event) => setGoal(event.target.value)} className="rounded-2xl" />
              </label>
            </div>

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 shadow-lg shadow-sky-500/20 hover:from-sky-700 hover:to-cyan-700">
                Generate roadmap <Sparkles className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="surface-card p-6 md:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Your roadmap for {field}</h2>
            <p className="mb-4 mt-1 text-slate-600">This roadmap is generated from your selected field and answers.</p>

            <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">Goal</p>
                <p className="text-sm font-semibold text-emerald-900">{goal}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">Weekly effort</p>
                <p className="text-sm font-semibold text-emerald-900">{weeklyHours} hours/week</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">Estimated completion</p>
                <p className="text-sm font-semibold text-emerald-900">{estimatedCompletionDate}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="relative">
                <div className="absolute left-5 top-8 bottom-8 w-px bg-gradient-to-b from-sky-400 via-indigo-400 to-emerald-400 opacity-60" />
                <div className="space-y-4">
                  {roadmapFlow.map((node, index) => (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * index, duration: 0.45 }}
                      className="relative flex items-start gap-4 pl-2"
                    >
                      <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${node.tone} text-sm font-bold text-white shadow-lg shadow-slate-300/40`}>
                        {node.id}
                      </div>
                      <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          <span>Milestone {node.id}</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                          <span>Flow step</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800">{node.title}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={completeOnboarding}
                disabled={profileMutation.isPending || refreshRecommendations.isPending}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
              >
                Get course recommendations <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}