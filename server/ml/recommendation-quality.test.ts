import { describe, expect, it } from "vitest";
import {
  contentBasedRecommendations,
  collaborativeRecommendations,
  hybridRecommendations,
  learningPatternRecommendations,
  popularityRecommendations,
} from "./recommender";

describe("recommendation quality guards", () => {
  it("keeps recommendation scores within [0, 1]", async () => {
    const userId = 1;
    const algorithms = [
      () => contentBasedRecommendations(userId, 5),
      () => collaborativeRecommendations(userId, 5),
      () => learningPatternRecommendations(userId, 5),
      () => popularityRecommendations(userId, 5),
      () => hybridRecommendations(userId, 5),
    ];

    for (const run of algorithms) {
      const recs = await run();
      for (const rec of recs) {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("respects requested recommendation limit", async () => {
    const recs = await hybridRecommendations(1, 4);
    expect(recs.length).toBeLessThanOrEqual(4);
  });
});
