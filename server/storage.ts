import { db } from "./db";
import {
  user,
  word,
  userWordProgress,
  passage,
  passageWord,
  userReadingProgress,
  type User,
  type InsertUser,
  type Word,
  type UserWordProgress,
  type Passage,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getWords(userId?: number): Promise<(Word & { userWordProgress?: UserWordProgress })[]>;
  getWordWithProgress(wordId: number, userId: number): Promise<(Word & { userWordProgress?: UserWordProgress }) | undefined>;
  
  getReadingPassages(): Promise<Passage[]>;
  getReadingPassage(id: number): Promise<Passage | undefined>;

  updateWordProgress(userWordId: number): Promise<UserWordProgress | undefined>;

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

  async getWords(userId: number = 1): Promise<(Word & { userWordProgress?: UserWordProgress })[]> {
    // Get all words with their user progress
    const words = await db.select().from(word);
    
    // Get user word progress for the given user
    const progressRecords = await db
      .select()
      .from(userWordProgress)
      .where(eq(userWordProgress.userId, userId));
    
    // Create a map for easier lookup
    const progressMap = new Map(progressRecords.map(p => [p.wordId, p]));
    
    // Combine words with their progress
    return words.map(w => ({
      ...w,
      userWordProgress: progressMap.get(w.wordId),
    }));
  }

  async getWordWithProgress(wordId: number, userId: number): Promise<(Word & { userWordProgress?: UserWordProgress }) | undefined> {
    const [wordResult] = await db.select().from(word).where(eq(word.wordId, wordId));
    if (!wordResult) return undefined;

    const [progressResult] = await db
      .select()
      .from(userWordProgress)
      .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.wordId, wordId)));

    return {
      ...wordResult,
      userWordProgress: progressResult,
    };
  }

  async getReadingPassages(): Promise<Passage[]> {
    const passages = await db.select().from(passage);
    // Add compatibility fields for existing code
    return passages.map(p => ({
      ...p,
      id: p.passageId,
      content: p.bodyText,
      level: p.readingLevel.toString(),
      imageUrl: p.audioUrl || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    })) as Passage[];
  }

  async getReadingPassage(id: number): Promise<Passage | undefined> {
    const [result] = await db.select().from(passage).where(eq(passage.passageId, id));
    if (!result) return undefined;
    // Add compatibility fields for existing code
    return {
      ...result,
      id: result.passageId,
      content: result.bodyText,
      level: result.readingLevel.toString(),
      imageUrl: result.audioUrl || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    } as Passage;
  }

  async updateWordProgress(userWordId: number): Promise<UserWordProgress | undefined> {
    // Get the current progress record
    const [currentProgress] = await db
      .select()
      .from(userWordProgress)
      .where(eq(userWordProgress.userWordId, userWordId));

    if (!currentProgress) return undefined;

    // Update: increment times_seen, set status to 'mastered', update last_seen_at
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

  async seedData(): Promise<void> {
    // Check if words exist
    const existingWords = await db.select().from(word);
    if (existingWords.length === 0) {
      // Use raw SQL to insert words
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

    // Seed users if they don't exist yet
    const tom = await this.getUserByUsername("TomSawyer");
    if (!tom) {
      await db.execute(sql`
        INSERT INTO "user" (email, display_name, username, password)
        VALUES ('tom@example.com', 'Tom Sawyer', 'TomSawyer', 'cantreadyet')
      `);
    }
    const xie = await this.getUserByUsername("XieXie");
    if (!xie) {
      await db.execute(sql`
        INSERT INTO "user" (email, display_name, username, password)
        VALUES ('xiexie@example.com', 'Xie Xie', 'XieXie', 'thankyou')
      `);
    }

    // Check if user word progress exists  
    const existingProgress = await db.select().from(userWordProgress);
    if (existingProgress.length === 0) {
      // Create progress records for all words using SELECT to avoid ID specification
      await db.execute(sql`
        INSERT INTO user_word_progress (user_id, word_id, status, times_seen, last_seen_at)
        SELECT 1, word_id, 'new', 0, NULL FROM word
      `);
    }

    // Check if passages exist
    const existingPassages = await db.select().from(passage);
    if (existingPassages.length === 0) {
      await db.execute(sql`
        INSERT INTO passage (title, body_text, reading_level, audio_url)
        VALUES 
          ('Treasure Island Excerpt', 'Well, then, said he, this is the berth for me. Here you, matey, he cried to the man who trundled the barrow; bring up alongside and help up my chest. I''ll stay here a bit, he continued.', 2, 'https://example.com/treasure_island.mp3')
      `);
    }
  }
}

export const storage = new DatabaseStorage();
