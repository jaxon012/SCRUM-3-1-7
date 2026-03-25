import type { Express, Request, Response } from "express";
import type { Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAudioRoutes } from "./replit_integrations/audio";
import { registerImageRoutes } from "./replit_integrations/image";
import { db } from "./db";
import { userStreak } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getAnthropic, resolveAnthropicApiKey } from "./anthropic";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const getAuthenticatedUserId = (req: Request, res: Response): number | null => {
    const raw = req.session.userId;
    const userId =
      typeof raw === "number" && Number.isFinite(raw)
        ? raw
        : Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(401).json({ message: "Unauthorized" });
      return null;
    }
    return userId;
  };

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    next();
  });

  const sessionSecret =
    process.env.SESSION_SECRET || "lingoquest-secret-key-dev-only";
  if (process.env.NODE_ENV === "production" && sessionSecret === "lingoquest-secret-key-dev-only") {
    console.warn(
      "[session] Set SESSION_SECRET in production; using default is insecure.",
    );
  }

  const isProd = process.env.NODE_ENV === "production";

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: isProd,
      cookie: {
        secure: isProd,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  // Auth routes
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    // Support both bcrypt hashed passwords and legacy plaintext
    const isValid = user.password.startsWith("$2")
      ? await storage.verifyPassword(password, user.password)
      : user.password === password;
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.regenerate(async (regenErr) => {
      if (regenErr) {
        console.error("Session regenerate error:", regenErr);
        return res.status(500).json({ message: "Could not start session" });
      }
      req.session.userId = user.userId;

      try {
        const today = new Date().toISOString().split("T")[0];
        const [existing] = await db.select().from(userStreak).where(eq(userStreak.userId, user.userId));
        if (!existing) {
          await db.insert(userStreak).values({ userId: user.userId, streakCount: 1, lastActivityDate: today });
        } else {
          const last = existing.lastActivityDate ? new Date(existing.lastActivityDate) : null;
          const diffDays = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : 999;
          if (diffDays === 1) {
            await db.update(userStreak).set({ streakCount: existing.streakCount + 1, lastActivityDate: today }).where(eq(userStreak.userId, user.userId));
          } else if (diffDays >= 2) {
            await db.update(userStreak).set({ streakCount: 0, lastActivityDate: today }).where(eq(userStreak.userId, user.userId));
          }
        }

        res.json({ userId: user.userId, displayName: user.displayName, username: user.username, role: user.role });
      } catch (e) {
        console.error("Login streak update error:", e);
        res.status(500).json({ message: "Internal server error" });
      }
    });
  });

  app.post("/api/signup", async (req, res) => {
    const { username, password, email, displayName } = req.body;
    if (!username || !password || !email || !displayName) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existingUsername = await storage.getUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ message: "Username already taken" });
    }
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ message: "Email already in use" });
    }
    const user = await storage.createUserWithHash({ username, password, email, displayName });

    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error("Session regenerate error:", regenErr);
        return res.status(500).json({ message: "Could not start session" });
      }
      req.session.userId = user.userId;
      res.status(201).json({ userId: user.userId, displayName: user.displayName, username: user.username, role: user.role });
    });
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/me", async (req, res) => {
    const sid = req.session.userId;
    const userId =
      typeof sid === "number" && Number.isFinite(sid) ? sid : Number(sid);
    if (!Number.isFinite(userId) || userId <= 0) return res.json(null);
    const user = await storage.getUser(userId);
    if (!user) return res.json(null);
    res.json({ userId: user.userId, displayName: user.displayName, username: user.username, role: user.role });
  });

  // Admin routes
  app.get("/api/admin/users", async (req, res) => {
    const adminSessionUserId = getAuthenticatedUserId(req, res);
    if (!adminSessionUserId) return;
    const currentUser = await storage.getUser(adminSessionUserId);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(u => ({
      userId: u.userId,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      password: u.password,
      passwordPlain: u.passwordPlain,
      role: u.role,
      createdAt: u.createdAt,
    })));
  });

  // Register Integration Routes
  registerAudioRoutes(app);
  registerImageRoutes(app);

  app.get(api.words.list.path, async (req, res) => {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const words = await storage.getWords(userId);
    res.json(words);
  });

  // Vocab list routes
  app.get(api.vocabLists.list.path, async (req, res) => {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const lists = await storage.getVocabLists(userId);
    res.json(lists);
  });

  app.post(api.vocabLists.create.path, async (req, res) => {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const { name } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const list = await storage.createVocabList(userId, name.trim());
    res.status(201).json(list);
  });

  app.get(api.vocabLists.words.list.path, async (req, res) => {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const listId = Number(req.params.listId);
    if (!listId || Number.isNaN(listId)) {
      return res.status(400).json({ message: "Invalid listId" });
    }
    const words = await storage.getVocabListWords(userId, listId);
    if (!words.length) {
      const lists = await storage.getVocabLists(userId);
      if (!lists.find((l) => l.vocabListId === listId)) {
        return res.status(404).json({ message: "List not found" });
      }
    }
    res.json(words);
  });

  app.post(api.vocabLists.words.add.path, async (req, res) => {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const listId = Number(req.params.listId);
    const { wordId } = req.body || {};
    if (!listId || Number.isNaN(listId) || !wordId || Number.isNaN(Number(wordId))) {
      return res.status(400).json({ message: "Invalid listId or wordId" });
    }

    const result = await storage.addWordToList(userId, listId, Number(wordId));
    if (!result) {
      return res.status(404).json({ message: "List not found" });
    }
    res.status(201).json(result);
  });

  app.post(api.vocabLists.words.addFromTerm.path, async (req, res) => {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const listId = Number(req.params.listId);
    const { term } = req.body || {};
    if (!listId || Number.isNaN(listId) || !term || typeof term !== "string") {
      return res.status(400).json({ message: "Invalid listId or term" });
    }

    try {
      const word = await storage.createOrGetWordFromTerm(term);
      const result = await storage.addWordToList(userId, listId, word.wordId);
      if (!result) {
        return res.status(404).json({ message: "List not found" });
      }
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding word from term:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.wordProgress.update.path, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const userWordId = Number(req.params.userWordId);
      
      if (!userWordId || isNaN(userWordId)) {
        return res.status(400).json({ message: "Invalid userWordId" });
      }

      const updated = await storage.updateWordProgress(userWordId, userId);
      
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

  app.post(api.addToVocab.path, async (req, res) => {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;

    const { term } = req.body;
    if (!term || typeof term !== "string") {
      return res.status(400).json({ message: "term is required", field: "term" });
    }
    const result = await storage.addWordToVocab(term.trim(), userId);
    res.json({ wordId: result.wordId, term: result.term });
  });

  app.get("/api/streak", async (req, res) => {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const [row] = await db.select().from(userStreak).where(eq(userStreak.userId, userId));
    res.json({ streakCount: row?.streakCount ?? 0 });
  });

  // Adventure chat endpoint — stateless, frontend sends full history
  app.post("/api/adventure/message", async (req, res) => {
    try {
      if (!resolveAnthropicApiKey()) {
        return res.status(503).json({
          error:
            "Adventure chat is not configured: set ANTHROPIC_API_KEY in your environment (.env).",
        });
      }

      const { messages, turnNumber } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }

      const isFinalTurn = turnNumber >= 5;

      let systemPrompt = "You are a storyteller guiding a language learning adventure. Narrate an interactive story where the user makes choices to progress. Keep responses to 2-3 short paragraphs. End each response with a clear choice or question for the user. Use vivid but simple language appropriate for language learners. Stay in character as the narrator.";

      if (isFinalTurn) {
        systemPrompt += "\n\nThis is the final turn of the adventure. Wrap up the story with a satisfying conclusion based on the user's choices. Do NOT offer new choices. End with a brief, memorable closing line.";
      }

      const claudeMessages = messages
        .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
        .map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = getAnthropic().messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
      });

      stream.on("text", (text) => {
        res.write(`data: ${JSON.stringify({ type: "content", content: text })}\n\n`);
      });

      stream.on("end", () => {
        res.write(`data: ${JSON.stringify({ type: "done", turnNumber, isComplete: isFinalTurn })}\n\n`);
        res.end();
      });

      stream.on("error", (error) => {
        console.error("Claude stream error:", error);
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to generate response" })}\n\n`);
          res.end();
        } else {
          res.status(500).json({ error: "Failed to generate response" });
        }
      });
    } catch (error) {
      console.error("Error in adventure chat:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  });

  // Seed data on startup
  await storage.seedData();

  return httpServer;
}
