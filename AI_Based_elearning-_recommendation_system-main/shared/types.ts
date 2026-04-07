/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

export interface RecommendationItem {
	rank: number;
	score: number;
	reason: string;
	algorithm: string;
	courseId: number;
	title: string;
	category: string;
	difficulty: "beginner" | "intermediate" | "advanced";
	tags: string[];
	instructor: string | null;
	duration: number | null;
	platform: string;
	platformUrl: string | null;
	platformPrice: string;
	rating: number;
	learnerCount: number;
	completionRate: number;
	thumbnailUrl: string | null;
}

export interface RecommendationStats {
	totalRecommendations: number;
	avgScore: number;
	algorithmUsed: string;
	expiresAt: string;
	topCategory: string;
}

export type FeedbackType = "positive" | "negative";
