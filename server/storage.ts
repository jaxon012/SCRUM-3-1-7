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
import { eq, and, sql, count, asc, desc, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { fetchPexelsPhotoUrl } from "./pexels";

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

  updateWordProgress(userWordId: number, userId: number): Promise<UserWordProgress | undefined>;
  markWordAsMastered(wordId: number, userId: number): Promise<UserWordProgress>;
  addWordToVocab(term: string, userId: number): Promise<Word>;

  getVocabLists(userId: number): Promise<(VocabList & { wordCount: number })[]>;
  createVocabList(userId: number, name: string): Promise<VocabList>;
  getVocabListWords(
    userId: number,
    listId: number
  ): Promise<(Word & { userWordProgress?: UserWordProgress })[]>;
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
    const rows = await db
      .select({
        word: word,
        progress: userWordProgress,
      })
      .from(userWordProgress)
      .innerJoin(word, eq(userWordProgress.wordId, word.wordId))
      .where(eq(userWordProgress.userId, userId))
      .orderBy(asc(word.wordId));

    return rows.map(({ word: wordRow, progress }) => ({
      ...wordRow,
      userWordProgress: progress,
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

  async markWordAsMastered(wordId: number, userId: number): Promise<UserWordProgress> {
    const [currentProgress] = await db
      .select()
      .from(userWordProgress)
      .where(
        and(
          eq(userWordProgress.userId, userId),
          eq(userWordProgress.wordId, wordId),
        ),
      );

    if (currentProgress) {
      const [updated] = await db
        .update(userWordProgress)
        .set({
          timesSeen: currentProgress.timesSeen + 1,
          status: "mastered",
          lastSeenAt: new Date(),
        })
        .where(
          and(
            eq(userWordProgress.userWordId, currentProgress.userWordId),
            eq(userWordProgress.userId, userId),
          ),
        )
        .returning();
      // If the row existed, returning() should always give us a row back.
      return updated ?? (currentProgress as UserWordProgress);
    }

    const [created] = await db
      .insert(userWordProgress)
      .values({
        userId,
        wordId,
        status: "mastered",
        timesSeen: 1,
        lastSeenAt: new Date(),
      })
      .returning();

    return created;
  }

  async addWordToVocab(term: string, userId: number): Promise<Word> {
    const cleanTerm = term.trim();
    if (!cleanTerm) {
      throw new Error("term is required");
    }
    const wordRecord = await this.createOrGetWordFromTerm(cleanTerm);
    const [existingProgress] = await db
      .select()
      .from(userWordProgress)
      .where(
        and(
          eq(userWordProgress.userId, userId),
          eq(userWordProgress.wordId, wordRecord.wordId)
        )
      );
    if (!existingProgress) {
      await db.insert(userWordProgress).values({
        userId,
        wordId: wordRecord.wordId,
        status: "new",
        timesSeen: 0,
        lastSeenAt: null,
      });
    }
    return wordRecord;
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

  async getVocabListWords(
    userId: number,
    listId: number
  ): Promise<(Word & { userWordProgress?: UserWordProgress })[]> {
    const [list] = await db
      .select()
      .from(vocabList)
      .where(eq(vocabList.vocabListId, listId));
    if (!list || list.userId !== userId) {
      return [];
    }

    const words = await db
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

    if (!words.length) return [];

    const wordIds = words.map((w) => w.wordId);

    // Attach per-user progress so WordCard can enable "Mark as Mastered" in list mode.
    const progressRecords = await db
      .select()
      .from(userWordProgress)
      .where(and(eq(userWordProgress.userId, userId), inArray(userWordProgress.wordId, wordIds)));

    const progressMap = new Map(progressRecords.map((p) => [p.wordId, p]));

    return words.map((w) => ({
      ...w,
      userWordProgress: progressMap.get(w.wordId),
    }));
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
      const pexelsResult = await fetchPexelsPhotoUrl(cleanTerm);
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

    const shouldSeedUsers = existingUsers.length === 0;
    const shouldSeedWords = existingWords.length === 0;
    const shouldSeedPassages = existingPassages.length === 0;
    const shouldSeedProgress = existingUserWordProgress.length === 0;

    if (shouldSeedUsers) {
      const tomHash = await bcrypt.hash("cantreadyet", 10);
      const xieHash = await bcrypt.hash("thankyou", 10);
      const adminHash = await bcrypt.hash("password", 10);
      await db.insert(user).values([
        { email: "tom@example.com", displayName: "Tom Sawyer", username: "TomSawyer", password: tomHash, passwordPlain: "cantreadyet", role: "user" },
        { email: "xiexie@example.com", displayName: "Xie Xie", username: "XieXie", password: xieHash, passwordPlain: "thankyou", role: "user" },
        { email: "admin@lingoquest.com", displayName: "Super Admin", username: "SuperAdmin", password: adminHash, passwordPlain: "password", role: "admin" },
      ]);
    } else {
      const adminExists = await this.getUserByUsername("SuperAdmin");
      if (!adminExists) {
        const adminHash = await bcrypt.hash("password", 10);
        await db.insert(user).values({
          email: "admin@lingoquest.com", displayName: "Super Admin", username: "SuperAdmin",
          password: adminHash, passwordPlain: "password", role: "admin",
        });
      }
    }

    if (shouldSeedWords) {
      await db.execute(sql`
        INSERT INTO word (term, definition, phonetic, audio_url)
        VALUES
          ('application', 'A formal request to an authority for something.', '/ˌapləˈkāSH(ə)n/', 'https://example.com/application.mp3'),
          ('work', 'Activity involving mental or physical effort done in order to achieve a purpose or result.', '/wərk/', 'https://example.com/work.mp3'),
          ('employee', 'A person employed for wages or salary, especially at non-executive level.', '/əmˈploiē/', 'https://example.com/employee.mp3'),
          ('hours', 'A period of time equal to sixty minutes.', '/ˈou(ə)rz/', 'https://example.com/hours.mp3'),
          ('shift', 'One of two or more recurring periods in which different groups of workers do the same jobs in relay.', '/SHift/', 'https://example.com/shift.mp3'),
          ('matey', 'A familiar and sometimes hostile form of address, especially to a stranger.', '/ˈmādē/', 'https://example.com/matey.mp3')
      `);
    }

    // Always backfill missing images (including previously seeded words).
    const seededWords = await db.select().from(word);
    const missingImages = seededWords.filter((w) => !w.imageUrl);
    const MAX_BACKFILL_PER_START = 25;
    const toBackfill = missingImages.slice(0, MAX_BACKFILL_PER_START);

    for (const w of toBackfill) {
      try {
        const combinedQuery = `${w.term} - ${w.definition}`;
        const imageUrl = await fetchPexelsPhotoUrl(combinedQuery);
        if (!imageUrl) continue;
        await db
          .update(word)
          .set({ imageUrl })
          .where(eq(word.wordId, w.wordId));
      } catch (error) {
        console.error(`Failed to fetch Pexels image for word "${w.term}":`, error);
      }
    }

    if (shouldSeedProgress) {
      await db.execute(sql`
        INSERT INTO user_word_progress (user_id, word_id, status, times_seen, last_seen_at)
        SELECT 1, word_id, 'new', 0, NULL FROM word
      `);
    }

    if (shouldSeedPassages) {
      await db.execute(sql`
        INSERT INTO passage (title, body_text, reading_level, audio_url, story_order)
        VALUES
          ('Treasure Island Excerpt', 'Well, then, said he, this is the berth for me. Here you, matey, he cried to the man who trundled the barrow; bring up alongside and help up my chest. I''ll stay here a bit, he continued.', 2, 'https://example.com/treasure_island.mp3', 0)
      `);
    }

    const [cefrCheck] = await db
      .select({ cnt: count() })
      .from(passage)
      .where(sql`story_order > 0`);
    if (Number(cefrCheck.cnt) === 0) {
      await this.seedCefrStories();
    }
  }
}

export const storage = new DatabaseStorage();