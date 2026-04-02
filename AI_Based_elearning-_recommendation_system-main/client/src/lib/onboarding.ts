export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type LearningStyle = "videos" | "projects" | "reading" | "mixed";

export type OnboardingData = {
  field: string;
  goal: string;
  weeklyHours: number;
  experienceLevel: ExperienceLevel;
  learningStyle: LearningStyle;
  roadmap: string[];
  createdAt: string;
};

const ONBOARDING_KEY = "eduai-onboarding-v1";

export const FIELD_OPTIONS = [
  "Web Development",
  "Data Science",
  "Machine Learning",
  "Mobile Development",
  "DevOps",
  "Cloud Computing",
  "Artificial Intelligence",
  "Cybersecurity",
  "Database Design",
  "Software Architecture",
  "Computer Science",
];

export const EXPERIENCE_OPTIONS: Array<{ value: ExperienceLevel; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export const LEARNING_STYLE_OPTIONS: Array<{ value: LearningStyle; label: string }> = [
  { value: "videos", label: "Video-first" },
  { value: "projects", label: "Project-first" },
  { value: "reading", label: "Reading-first" },
  { value: "mixed", label: "Mixed" },
];

export function buildRoadmap(data: {
  field: string;
  experienceLevel: ExperienceLevel;
  weeklyHours: number;
  goal: string;
  learningStyle: LearningStyle;
}): string[] {
  const pace = data.weeklyHours >= 10 ? "fast" : data.weeklyHours >= 5 ? "steady" : "light";
  const foundationByLevel: Record<ExperienceLevel, string> = {
    beginner: `Learn the fundamentals of ${data.field} and core terminology`,
    intermediate: `Reinforce mid-level ${data.field} concepts and eliminate knowledge gaps`,
    advanced: `Review advanced ${data.field} patterns and production best practices`,
  };

  const styleHint: Record<LearningStyle, string> = {
    videos: "Prioritize structured video courses with chapter checkpoints",
    projects: "Prioritize project-based courses with portfolio deliverables",
    reading: "Prioritize theory-driven courses with docs and deep-dive notes",
    mixed: "Blend video, reading, and mini-projects every week",
  };

  return [
    `Week 1-2 (${pace} pace): ${foundationByLevel[data.experienceLevel]}`,
    `Week 3-4: ${styleHint[data.learningStyle]}`,
    `Week 5-6: Build one guided project in ${data.field} and document learnings`,
    `Week 7-8: Focus on your goal: ${data.goal}`,
    "Week 9+: Start interview prep or advanced specialization tracks",
  ];
}

export function saveOnboardingData(data: OnboardingData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
}

export function getOnboardingData(): OnboardingData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ONBOARDING_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OnboardingData;
  } catch {
    return null;
  }
}

export function hasCompletedOnboarding(): boolean {
  return Boolean(getOnboardingData());
}

type ProfileLike = {
  interests?: string | null;
  learningGoals?: string | null;
  preferredDifficulty?: string | null;
  learningStyle?: string | null;
  onboardingCompletedAt?: string | Date | number | null;
};

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

export function readProfilePreferences(profile: ProfileLike | null | undefined) {
  const interests = parseJsonArray(profile?.interests);
  const goals = parseJsonArray(profile?.learningGoals);

  return {
    interests,
    goals,
    preferredDifficulty: profile?.preferredDifficulty ?? null,
    learningStyle: profile?.learningStyle ?? null,
  };
}

export function hasCompletedOnboardingInProfile(profile: ProfileLike | null | undefined): boolean {
  if (profile?.onboardingCompletedAt) {
    return true;
  }

  const prefs = readProfilePreferences(profile);
  return (
    prefs.interests.length > 0 &&
    prefs.goals.length > 0 &&
    Boolean(prefs.preferredDifficulty) &&
    Boolean(prefs.learningStyle)
  );
}

export function getEstimatedCompletionDate(weeklyHours: number): string {
  const targetWeeks = weeklyHours >= 10 ? 8 : weeklyHours >= 5 ? 10 : 12;
  const completion = new Date();
  completion.setDate(completion.getDate() + targetWeeks * 7);
  return completion.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
