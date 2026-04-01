import { generateRecommendations } from "../recommendationEngine";

const INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startRecommendationCron(): void {
  console.log("🕐 Recommendation cron started (interval: 24h)");

  setTimeout(() => {
    generateRecommendations().catch(console.error);
  }, 5000);

  setInterval(() => {
    console.log("♻️  Running scheduled recommendation refresh...");
    generateRecommendations().catch(console.error);
  }, INTERVAL_MS);
}
