import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerChatRoutes } from "./chat";
import { appRouter } from "./appRouter";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { db } from "./db";
import { normalizeAdminRoles } from "../db";
import {
  generateRecommendations,
  getRecommendationsForUser,
} from "../recommendationEngine";
import { startRecommendationCron } from "../jobs/recommendationCron";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const demotedAdmins = await normalizeAdminRoles();
  if (demotedAdmins > 0) {
    console.warn(`[Auth] Demoted ${demotedAdmins} non-owner admin account(s) to user.`);
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Chat API with streaming and tool calling
  registerChatRoutes(app);

  // REST fallback routes for recommendations
  app.get("/api/v1/recommendations/:userId", async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        res.status(400).json({ error: "Invalid userId" });
        return;
      }

      const rows = await getRecommendationsForUser(userId);
      res.json(rows);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/v1/recommendations/refresh", async (req, res) => {
    try {
      const body = req.body as { userId?: unknown };
      const userId =
        typeof body?.userId === "number" && Number.isInteger(body.userId) && body.userId > 0
          ? body.userId
          : undefined;

      await generateRecommendations(userId);
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/v1/recommendations/feedback", async (req, res) => {
    try {
      const body = req.body as {
        recommendationId?: unknown;
        feedback?: unknown;
        userId?: unknown;
      };

      if (
        typeof body?.recommendationId !== "number" ||
        !Number.isInteger(body.recommendationId) ||
        body.recommendationId <= 0
      ) {
        res.status(400).json({ error: "Invalid recommendationId" });
        return;
      }

      if (typeof body.feedback !== "string" || body.feedback.trim().length === 0) {
        res.status(400).json({ error: "Invalid feedback" });
        return;
      }

      const userId =
        typeof body.userId === "number" && Number.isInteger(body.userId) && body.userId > 0
          ? body.userId
          : 1;

      db.prepare(
        `INSERT INTO recommendationFeedback (userId, recommendationId, feedback, timestamp)
         VALUES (?, ?, ?, ?)`
      ).run(
        userId,
        body.recommendationId,
        body.feedback,
        Math.floor(Date.now() / 1000)
      );

      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startRecommendationCron();
  });
}

startServer().catch(console.error);
