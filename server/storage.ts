import { db } from "./db";
import {
  user,
  word,
  userWordProgress,
  passage,
  userReadingProgress,
  vocabList,
  vocabListWord,
  type User,
  type InsertUser,
  type Word,
  type UserWordProgress,
  type Passage,
  type VocabList,
} from "@shared/schema";
import { eq, and, sql, count, asc, desc } from "drizzle-orm";
import bcrypt from "bcrypt";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

async function fetchPexelsImageUrl(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY) {
    console.warn("PEXELS_API_KEY is not set; skipping image lookup.");
    return null;
  }

  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: PEXELS_API_KEY,
      },
    });

    if (!res.ok) {
      console.error("Pexels API error status:", res.status);
      return null;
    }

    const data: any = await res.json();
    const photo = data?.photos?.[0];
    const src = photo?.src;
    return (
      src?.large ||
      src?.medium ||
      src?.large2x ||
      src?.original ||
      null
    );
  } catch (error) {
    console.error("Error calling Pexels API:", error);
    return null;
  }
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  createUserWithHash(data: { username: string; password: string; email: string; displayName: string }): Promise<User>;
  verifyPassword(plaintext: string, hash: string): Promise<boolean>;

  getWords(userId?: number): Promise<(Word & { userWordProgress?: UserWordProgress })[]>;
  getWordWithProgress(
    wordId: number,
    userId: number
  ): Promise<(Word & { userWordProgress?: UserWordProgress }) | undefined>;

  getReadingPassages(): Promise<Passage[]>;
  getReadingPassage(id: number): Promise<Passage | undefined>;
  getCurrentReadingProgress(userId: number): Promise<number | null>;
  upsertReadingProgress(userId: number, passageId: number): Promise<void>;
  getLastReadPassageInLevel(userId: number, level: number): Promise<number | null>;

  updateWordProgress(userWordId: number): Promise<UserWordProgress | undefined>;
  addWordToVocab(term: string, userId: number): Promise<Word>;

  getVocabLists(userId: number): Promise<(VocabList & { wordCount: number })[]>;
  createVocabList(userId: number, name: string): Promise<VocabList>;
  getVocabListWords(userId: number, listId: number): Promise<Word[]>;
  addWordToList(userId: number, listId: number, wordId: number): Promise<{ vocabListWordId: number; vocabListId: number; wordId: number } | null>;

  createOrGetWordFromTerm(term: string): Promise<Word>;

  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.userId, id));
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.email, email));
    return result;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.username, username));
    return result;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [result] = await db.insert(user).values(insertUser).returning();
    return result;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(user);
  }

  async createUserWithHash(data: { username: string; password: string; email: string; displayName: string }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [result] = await db.insert(user).values({
      username: data.username,
      password: hashedPassword,
      passwordPlain: data.password,
      email: data.email,
      displayName: data.displayName,
      role: "user",
    }).returning();
    return result;
  }

  async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  async getWords(
    userId: number = 1
  ): Promise<(Word & { userWordProgress?: UserWordProgress })[]> {
    const words = await db.select().from(word);

    const progressRecords = await db
      .select()
      .from(userWordProgress)
      .where(eq(userWordProgress.userId, userId));

    const progressMap = new Map(progressRecords.map((p) => [p.wordId, p]));

    return words.map((w) => ({
      ...w,
      userWordProgress: progressMap.get(w.wordId),
    }));
  }

  async getWordWithProgress(
    wordId: number,
    userId: number
  ): Promise<(Word & { userWordProgress?: UserWordProgress }) | undefined> {
    const [wordResult] = await db.select().from(word).where(eq(word.wordId, wordId));
    if (!wordResult) return undefined;

    const [progressResult] = await db
      .select()
      .from(userWordProgress)
      .where(
        and(
          eq(userWordProgress.userId, userId),
          eq(userWordProgress.wordId, wordId)
        )
      );

    return {
      ...wordResult,
      userWordProgress: progressResult,
    };
  }

  async getReadingPassages(): Promise<Passage[]> {
    const passages = await db
      .select()
      .from(passage)
      .orderBy(asc(passage.readingLevel), asc(passage.storyOrder), asc(passage.passageId));

    return passages.map((p) => ({
      ...p,
      id: p.passageId,
      content: p.bodyText,
      level: p.readingLevel.toString(),
      imageUrl:
        p.audioUrl ||
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    })) as Passage[];
  }

  async getReadingPassage(id: number): Promise<Passage | undefined> {
    const [result] = await db.select().from(passage).where(eq(passage.passageId, id));
    if (!result) return undefined;

    return {
      ...result,
      id: result.passageId,
      content: result.bodyText,
      level: result.readingLevel.toString(),
      imageUrl:
        result.audioUrl ||
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    } as Passage;
  }

  async getCurrentReadingProgress(userId: number): Promise<number | null> {
    const rows = await db
      .select()
      .from(userReadingProgress)
      .where(eq(userReadingProgress.userId, userId))
      .orderBy(desc(userReadingProgress.completedAt))
      .limit(1);
    return rows.length > 0 ? rows[0].passageId : null;
  }

  async upsertReadingProgress(userId: number, passageId: number): Promise<void> {
    const existing = await db
      .select()
      .from(userReadingProgress)
      .where(
        and(
          eq(userReadingProgress.userId, userId),
          eq(userReadingProgress.passageId, passageId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userReadingProgress)
        .set({ completedAt: new Date(), percentComplete: 50 })
        .where(eq(userReadingProgress.userReadingId, existing[0].userReadingId));
    } else {
      await db.insert(userReadingProgress).values({
        userId,
        passageId,
        percentComplete: 50,
        completedAt: new Date(),
      });
    }
  }

  async getLastReadPassageInLevel(userId: number, level: number): Promise<number | null> {
    const rows = await db
      .select({
        passageId: userReadingProgress.passageId,
        completedAt: userReadingProgress.completedAt,
      })
      .from(userReadingProgress)
      .innerJoin(passage, eq(userReadingProgress.passageId, passage.passageId))
      .where(
        and(
          eq(userReadingProgress.userId, userId),
          eq(passage.readingLevel, level)
        )
      )
      .orderBy(desc(userReadingProgress.completedAt))
      .limit(1);

    return rows.length > 0 ? rows[0].passageId : null;
  }

  async updateWordProgress(userWordId: number, userId: number): Promise<UserWordProgress | undefined> {
    const [currentProgress] = await db
      .select()
      .from(userWordProgress)
      .where(
        and(
          eq(userWordProgress.userWordId, userWordId),
          eq(userWordProgress.userId, userId)
        )
      );

    if (!currentProgress) return undefined;

    const [updated] = await db
      .update(userWordProgress)
      .set({
        timesSeen: currentProgress.timesSeen + 1,
        status: "mastered",
        lastSeenAt: new Date(),
      })
      .where(
        and(
          eq(userWordProgress.userWordId, userWordId),
          eq(userWordProgress.userId, userId)
        )
      )
      .returning();

    return updated;
  }

  async getVocabLists(userId: number): Promise<(VocabList & { wordCount: number })[]> {
    const rows = await db
      .select({
        vocabListId: vocabList.vocabListId,
        userId: vocabList.userId,
        name: vocabList.name,
        createdAt: vocabList.createdAt,
        wordCount: count(vocabListWord.wordId),
      })
      .from(vocabList)
      .leftJoin(vocabListWord, eq(vocabList.vocabListId, vocabListWord.vocabListId))
      .where(eq(vocabList.userId, userId))
      .groupBy(vocabList.vocabListId);

    return rows as (VocabList & { wordCount: number })[];
  }

  async createVocabList(userId: number, name: string): Promise<VocabList> {
    const [created] = await db
      .insert(vocabList)
      .values({ userId, name })
      .returning();
    return created;
  }

  async getVocabListWords(userId: number, listId: number): Promise<Word[]> {
    const [list] = await db
      .select()
      .from(vocabList)
      .where(eq(vocabList.vocabListId, listId));
    if (!list || list.userId !== userId) {
      return [];
    }

    const rows = await db
      .select({
        wordId: word.wordId,
        term: word.term,
        definition: word.definition,
        phonetic: word.phonetic,
        audioUrl: word.audioUrl,
        imageUrl: word.imageUrl,
      })
      .from(vocabListWord)
      .innerJoin(word, eq(vocabListWord.wordId, word.wordId))
      .where(eq(vocabListWord.vocabListId, listId));

    return rows as Word[];
  }

  async addWordToList(
    userId: number,
    listId: number,
    wordId: number
  ): Promise<{ vocabListWordId: number; vocabListId: number; wordId: number } | null> {
    const [list] = await db
      .select()
      .from(vocabList)
      .where(eq(vocabList.vocabListId, listId));
    if (!list || list.userId !== userId) {
      return null;
    }

    const existing = await db
      .select()
      .from(vocabListWord)
      .where(
        and(
          eq(vocabListWord.vocabListId, listId),
          eq(vocabListWord.wordId, wordId)
        )
      );
    if (existing.length > 0) {
      const row = existing[0];
      return {
        vocabListWordId: row.vocabListWordId,
        vocabListId: row.vocabListId,
        wordId: row.wordId,
      };
    }

    const [created] = await db
      .insert(vocabListWord)
      .values({ vocabListId: listId, wordId })
      .returning();

    return {
      vocabListWordId: created.vocabListWordId,
      vocabListId: created.vocabListId,
      wordId: created.wordId,
    };
  }

  async createOrGetWordFromTerm(term: string): Promise<Word> {
    const cleanTerm = term.trim();
    const lowered = cleanTerm.toLowerCase();

    const existing = await db
      .select()
      .from(word)
      .where(eq(word.term, lowered));
    if (existing.length > 0) {
      return existing[0];
    }

    let definition = "Definition not available.";
    let phonetic: string | null = null;
    let wordAudioUrl: string | null = null;

    try {
      const dictRes = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowered)}`
      );
      if (dictRes.ok) {
        const dictData: any[] = await dictRes.json();
        const entry = dictData[0];
        definition =
          entry?.meanings?.[0]?.definitions?.[0]?.definition ??
          "Definition not available.";
        phonetic =
          entry?.phonetics?.find((p: any) => p.text)?.text ?? null;
        wordAudioUrl =
          entry?.phonetics?.find((p: any) => p.audio && p.audio !== "")?.audio ??
          null;
      }
    } catch (err) {
      console.error(`[dict] Failed to fetch definition for "${lowered}":`, err);
    }

    let imageUrl: string | null = null;
    try {
      const pexelsResult = await fetchPexelsImageUrl(cleanTerm);
      imageUrl = pexelsResult;
    } catch (e) {
      console.error("Error fetching Pexels image for user-added word:", e);
    }

    const [created] = await db
      .insert(word)
      .values({
        term: lowered,
        definition,
        phonetic,
        audioUrl: wordAudioUrl,
        imageUrl: imageUrl ?? null,
      })
      .returning();

    return created;
  }

  private async seedCefrStories(): Promise<void> {
    const levelMap: Record<string, number> = {
      A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
    };
    const files = ["A1", "A2", "B1", "B2", "C1", "C2"];

    for (const levelKey of files) {
      const filePath = join(__dirname, "..", "cefr_story_levels_json", `${levelKey}.json`);
      const data = JSON.parse(readFileSync(filePath, "utf-8")) as {
        stories: { id: string; order: number; title: string; text: string }[];
      };
      const readingLevel = levelMap[levelKey];

      for (const story of data.stories) {
        await db.insert(passage).values({
          title: story.title,
          bodyText: story.text,
          readingLevel,
          storyOrder: story.order,
          audioUrl: null,
        });
      }
    }
    console.log("[seed] Seeded 60 CEFR stories.");
  }

  async seedData(): Promise<void> {
    const existingUsers = await db.select().from(user);
    const existingWords = await db.select().from(word);
    const existingPassages = await db.select().from(passage);

    const existingUserWordProgress = await db.select().from(userWordProgress);

    // Seed base rows only when the DB is empty, but always backfill missing images.
    const shouldSeedUsers = existingUsers.length === 0;
    const shouldSeedWords = existingWords.length === 0;
    const shouldSeedPassages = existingPassages.length === 0;
    const shouldSeedProgress = existing