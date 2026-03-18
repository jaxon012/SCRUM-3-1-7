import { db } from "./db";
import {
  user,
  word,
  userWordProgress,
  passage,
  vocabList,
  vocabListWord,
  type User,
  type InsertUser,
  type Word,
  type UserWordProgress,
  type Passage,
  type VocabList,
} from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";

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

  getWords(userId?: number): Promise<(Word & { userWordProgress?: UserWordProgress })[]>;
  getWordWithProgress(
    wordId: number,
    userId: number
  ): Promise<(Word & { userWordProgress?: UserWordProgress }) | undefined>;

  getReadingPassages(): Promise<Passage[]>;
  getReadingPassage(id: number): Promise<Passage | undefined>;

  updateWordProgress(userWordId: number): Promise<UserWordProgress | undefined>;

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
    const passages = await db.select().from(passage);

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

  async updateWordProgress(userWordId: number): Promise<UserWordProgress | undefined> {
    const [currentProgress] = await db
      .select()
      .from(userWordProgress)
      .where(eq(userWordProgress.userWordId, userWordId));

    if (!currentProgress) return undefined;

    const [updated] = await db
      .update(userWordProgress)
      .set({
        timesSeen: currentProgress.timesSeen + 1,
        status: "mastered",
        lastSeenAt: new Date(),
      })
      .where(eq(userWordProgress.userWordId, userWordId))
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

    const definition = "User-added word; definition to be set later.";

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
        phonetic: null,
        audioUrl: null,
        imageUrl: imageUrl ?? null,
      })
      .returning();

    return created;
  }

  async seedData(): Promise<void> {
    // If seed.sql already populated the DB, do nothing.
    const existingUsers = await db.select().from(user);
    const existingWords = await db.select().from(word);
    const existingPassages = await db.select().from(passage);

    if (
      existingUsers.length > 0 ||
      existingWords.length > 0 ||
      existingPassages.length > 0
    ) {
      return;
    }

    // Users
    await db.execute(sql`
      INSERT INTO "user" (email, display_name, username, password)
      VALUES
        ('tom@example.com', 'Tom Sawyer', 'TomSawyer', 'cantreadyet'),
        ('xiexie@example.com', 'Xie Xie', 'XieXie', 'thankyou')
    `);

    // Words
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

    // Look up and store images for each word using Pexels
    const seededWords = await db.select().from(word);
    for (const w of seededWords) {
      try {
        if (w.imageUrl) continue;

        // Build a richer search query using both term and definition
        const combinedQuery = `${w.term} - ${w.definition}`;
        const imageUrl = await fetchPexelsImageUrl(combinedQuery);
        if (!imageUrl) continue;

        await db
          .update(word)
          .set({ imageUrl })
          .where(eq(word.wordId, w.wordId));
      } catch (error) {
        console.error(`Failed to fetch Pexels image for word "${w.term}":`, error);
      }
    }

    // Basic progress for Tom
    await db.execute(sql`
      INSERT INTO user_word_progress (user_id, word_id, status, times_seen, last_seen_at)
      SELECT 1, word_id, 'new', 0, NULL FROM word
    `);

    // Passage
    await db.execute(sql`
      INSERT INTO passage (title, body_text, reading_level, audio_url)
      VALUES
        ('Treasure Island Excerpt', 'Well, then, said he, this is the berth for me. Here you, matey, he cried to the man who trundled the barrow; bring up alongside and help up my chest. I''ll stay here a bit, he continued.', 2, 'https://example.com/treasure_island.mp3')
    `);
  }
}

export const storage = new DatabaseStorage();