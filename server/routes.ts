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
    req.session.userId = user.userId;
    res.json({ userId: user.userId, displayName: user.displayName, username: user.username, role: user.role });
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
    req.session.userId = user.userId;
    res.status(201).json({ userId: user.userId, displayName: user.displayName, username: user.username, role: user.role });
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/me", async (req, res) => {
    if (!req.session.userId) return res.json(null);
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.json(null);
    res.json({ userId: user.userId, displayName: user.displayName, username: user.username, role: user.role });
  });

  // Admin routes
  app.get("/api/admin/users", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const currentUser = await storage.getUser(req.session.userId);
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
    const userId = req.session.userId || 1;
    const words = await storage.getWords(userId);
    res.json(words);
  });

  // Vocab list routes
  app.get(api.vocabLists.list.path, async (req, res) => {
    const userId = req.session.userId || 1;
    const lists = await storage.getVocabLists(userId);
    res.json(lists);
  });

  app.post(api.vocabLists.create.path, async (req, res) => {
    const userId = req.session.userId || 1;
    const { name } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const list = await storage.createVocabList(userId, name.trim());
    res.status(201).json(list);
  });

  app.get(api.vocabLists.words.list.path, async (req, res) => {
    const userId = req.session.userId || 1;
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
    const userId = req.session.userId || 1;
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
    const userId = req.session.userId || 1;
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

  app.post(api.addToVocab.path, async (req, res) => {
    const { term } = req.body;
    if (!term || typeof term !== "string") {
      return res.status(400).json({ message: "term is required", field: "term" });
    }
    const userId = req.session.userId || 1;
    const result = await storage.addWordToVocab(term.trim(), userId);
    res.json({ wordId: result.wordId, term: result.term });
  });

  // Seed data on startup
  await storage.seedData();

  return httpServer;
}
