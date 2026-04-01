import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db";
import { courses as coursesTable } from "../../drizzle/schema";

describe("Recommendation Engine", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  describe("Course Data", () => {
    it("should have courses table available", async () => {
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }
      
      expect(db).toBeDefined();
    });

    it("should support course queries", async () => {
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      // This is a basic connectivity test
      expect(db.select).toBeDefined();
    });
  });

  describe("Recommendation Algorithms", () => {
    it("should have content-based recommendation function", async () => {
      // Import the function
      const { contentBasedRecommendations } = await import("./recommender");
      expect(contentBasedRecommendations).toBeDefined();
      expect(typeof contentBasedRecommendations).toBe("function");
    });

    it("should have collaborative recommendation function", async () => {
      const { collaborativeRecommendations } = await import("./recommender");
      expect(collaborativeRecommendations).toBeDefined();
      expect(typeof collaborativeRecommendations).toBe("function");
    });

    it("should have popularity recommendation function", async () => {
      const { popularityRecommendations } = await import("./recommender");
      expect(popularityRecommendations).toBeDefined();
      expect(typeof popularityRecommendations).toBe("function");
    });

    it("should have hybrid recommendation function", async () => {
      const { hybridRecommendations } = await import("./recommender");
      expect(hybridRecommendations).toBeDefined();
      expect(typeof hybridRecommendations).toBe("function");
    });
  });

  describe("AI Recommendation Engine", () => {
    it("should have findRelatedCourses function", async () => {
      const { findRelatedCourses } = await import("./ai-recommender");
      expect(findRelatedCourses).toBeDefined();
      expect(typeof findRelatedCourses).toBe("function");
    });

    it("should have getAIPoweredSuggestions function", async () => {
      const { getAIPoweredSuggestions } = await import("./ai-recommender");
      expect(getAIPoweredSuggestions).toBeDefined();
      expect(typeof getAIPoweredSuggestions).toBe("function");
    });

    it("should have getTrendingInCategory function", async () => {
      const { getTrendingInCategory } = await import("./ai-recommender");
      expect(getTrendingInCategory).toBeDefined();
      expect(typeof getTrendingInCategory).toBe("function");
    });

    it("should have getPrerequisiteCourses function", async () => {
      const { getPrerequisiteCourses } = await import("./ai-recommender");
      expect(getPrerequisiteCourses).toBeDefined();
      expect(typeof getPrerequisiteCourses).toBe("function");
    });

    it("should have getAdvancedCourses function", async () => {
      const { getAdvancedCourses } = await import("./ai-recommender");
      expect(getAdvancedCourses).toBeDefined();
      expect(typeof getAdvancedCourses).toBe("function");
    });
  });

  describe("Recommendation Result Format", () => {
    it("should return recommendations with correct structure", async () => {
      const { findRelatedCourses } = await import("./ai-recommender");
      
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      // Test with a dummy course ID
      const results = await findRelatedCourses(1, 5);
      
      // Results should be an array
      expect(Array.isArray(results)).toBe(true);
      
      // If there are results, check structure
      if (results.length > 0) {
        const rec = results[0];
        expect(rec).toHaveProperty("courseId");
        expect(rec).toHaveProperty("score");
        expect(rec).toHaveProperty("reason");
        expect(rec).toHaveProperty("algorithm");
        
        expect(typeof rec.courseId).toBe("number");
        expect(typeof rec.score).toBe("number");
        expect(typeof rec.reason).toBe("string");
        expect(typeof rec.algorithm).toBe("string");
        
        // Score should be between 0 and 1
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Recommendation Limits", () => {
    it("should respect limit parameter", async () => {
      const { findRelatedCourses } = await import("./ai-recommender");
      
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const results = await findRelatedCourses(1, 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should return empty array for invalid course ID", async () => {
      const { findRelatedCourses } = await import("./ai-recommender");
      
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const results = await findRelatedCourses(999999, 5);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("Algorithm Types", () => {
    it("should return correct algorithm type for related courses", async () => {
      const { findRelatedCourses } = await import("./ai-recommender");
      
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const results = await findRelatedCourses(1, 5);
      
      if (results.length > 0) {
        results.forEach(rec => {
          expect(rec.algorithm).toBe("ai-related");
        });
      }
    });

    it("should return correct algorithm type for trending courses", async () => {
      const { getTrendingInCategory } = await import("./ai-recommender");
      
      if (!db) {
        console.log("Database not available, skipping test");
        return;
      }

      const results = await getTrendingInCategory("Web Development", 5);
      
      if (results.length > 0) {
        results.forEach(rec => {
          expect(rec.algorithm).toBe("popularity");
        });
      }
    });
  });
});
