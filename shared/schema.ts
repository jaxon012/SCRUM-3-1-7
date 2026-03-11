import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/chat";

// User table
export const user = pgTable("user", {
  userId: serial("user_id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Word table
export const word = pgTable("word", {
  wordId: serial("word_id").primaryKey(),
  term: varchar("term", { length: 120 }).notNull().unique(),
  definition: text("definition").notNull(),
  phonetic: varchar("phonetic", { length: 120 }),
  audioUrl: varchar("audio_url", { length: 500 }),
});

// User Word Progress table
export const userWordProgress = pgTable("user_word_progress", {
  userWordId: serial("user_word_id").primaryKey(),
  userId: integer("user_id").notNull(),
  wordId: integer("word_id").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("new"),
  timesSeen: integer("times_seen").notNull().default(0),
  lastSeenAt: timestamp("last_seen_at"),
});

// Reading passage table
export const passage = pgTable("passage", {
  passageId: serial("passage_id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  bodyText: text("body_text").notNull(),
  readingLevel: integer("reading_level").notNull(),
  audioUrl: varchar("audio_url", { length: 500 }),
});

// Passage word junction table
export const passageWord = pgTable("passage_word", {
  passageWordId: serial("passage_word_id").primaryKey(),
  passageId: integer("passage_id").notNull(),
  wordId: integer("word_id").notNull(),
});

// User reading progress table
export const userReadingProgress = pgTable("user_reading_progress", {
  userReadingId: serial("user_reading_id").primaryKey(),
  userId: integer("user_id").notNull(),
  passageId: integer("passage_id").notNull(),
  percentComplete: integer("percent_complete").notNull().default(0),
  completedAt: timestamp("completed_at"),
});

// For backward compatibility with existing components that expect "words" or "word" type
export const words = word;

export const insertUserSchema = createInsertSchema(user).omit({ userId: true, createdAt: true });
export const insertWordSchema = createInsertSchema(word).omit({ wordId: true });
export const insertUserWordProgressSchema = createInsertSchema(userWordProgress).omit({ userWordId: true });
export const insertPassageSchema = createInsertSchema(passage).omit({ passageId: true });
export const insertPassageWordSchema = createInsertSchema(passageWord).omit({ passageWordId: true });
export const insertUserReadingProgressSchema = createInsertSchema(userReadingProgress).omit({ userReadingId: true });

export type User = typeof user.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Word = typeof word.$inferSelect;
export type InsertWord = z.infer<typeof insertWordSchema>;
export type UserWordProgress = typeof userWordProgress.$inferSelect;
export type InsertUserWordProgress = z.infer<typeof insertUserWordProgressSchema>;

// Passage type with compatibility fields for existing code
export type PassageRaw = typeof passage.$inferSelect;
export interface Passage extends PassageRaw {
  // Compatibility aliases for Read.tsx
  id?: number;
  content?: string;
  level?: string;
  imageUrl?: string;
}

export type InsertPassage = z.infer<typeof insertPassageSchema>;
export type PassageWord = typeof passageWord.$inferSelect;
export type UserReadingProgress = typeof userReadingProgress.$inferSelect;
