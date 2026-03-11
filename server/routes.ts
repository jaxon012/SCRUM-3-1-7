import type { Express } from "express";
import type { Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAudioRoutes } from "./replit_integrations/audio";
import { registerImageRoutes } from "./replit_integrations/image";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(session({
    secret: "lingoquest-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  }));

  // Auth routes
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.session.userId = user.userId;
    res.json({ userId: user.userId, displayName: user.displayName, username: user.username });
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/me", async (req, res) => {
    if (!req.session.userId) return res.json(null);
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.json(null);
    res.json({ userId: user.userId, displayName: user.displayName, username: user.username });
  });

  // Register Integration Routes
  registerAudioRoutes(app);
  registerImageRoutes(app);

  app.get(api.words.list.path, async (req, res) => {
    const userId = req.session.userId || 1;
    const words = await storage.getWords(userId);
    res.json(words);
  });

  app.patch(api.wordProgress.update.path, async (req, res) => {
    try {
      const userWordId = Number(req.params.userWordId);
      
      if (!userWordId || isNaN(userWordId)) {
        return res.status(400).json({ message: "Invalid userWordId" });
      }

      const updated = await storage.updateWordProgress(userWordId);
      
      if (!updated) {
        return res.status(404).json({ message: "Word progress not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating word progress:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.readingPassages.list.path, async (req, res) => {
    const passages = await storage.getReadingPassages();
    res.json(passages);
  });

  app.get(api.readingPassages.get.path, async (req, res) => {
    const passage = await storage.getReadingPassage(Number(req.params.id));
    if (!passage) {
      return res.status(404).json({ message: "Passage not found" });
    }
    res.json(passage);
  });

  // Seed data on startup
  await storage.seedData();

  return httpServer;
}
