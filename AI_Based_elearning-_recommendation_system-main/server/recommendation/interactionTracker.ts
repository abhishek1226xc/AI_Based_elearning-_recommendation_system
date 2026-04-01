import { sendFeedback } from "../ml/pythonClient";

export function trackInteraction(
    userId: number,
    courseId: number,
    interactionType: string
): void {
    // Send background analytics event to ML microservice.
    sendFeedback(userId, courseId, interactionType).catch((err) => {
        console.error("Analytics error:", err);
    });
}
