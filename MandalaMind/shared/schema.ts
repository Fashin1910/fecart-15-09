import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  attentionLevel: integer("attention_level").default(0),
  meditationLevel: integer("meditation_level").default(0),
  signalQuality: integer("signal_quality").default(0),
  voiceTranscript: text("voice_transcript"),
  aiPrompt: text("ai_prompt"),
  mandalaUrl: text("mandala_url"),
  isActive: boolean("is_active").default(true),
});

export const mandalas = pgTable("mandalas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  brainwaveData: jsonb("brainwave_data").notNull(),
  voiceTranscript: text("voice_transcript"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eegData = pgTable("eeg_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id),
  attention: integer("attention").notNull(),
  meditation: integer("meditation").notNull(),
  signalQuality: integer("signal_quality").notNull(),
  rawData: jsonb("raw_data"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertMandalaSchema = createInsertSchema(mandalas).omit({
  id: true,
  createdAt: true,
});

export const insertEegDataSchema = createInsertSchema(eegData).omit({
  id: true,
  timestamp: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export type InsertMandala = z.infer<typeof insertMandalaSchema>;
export type Mandala = typeof mandalas.$inferSelect;

export type InsertEegData = z.infer<typeof insertEegDataSchema>;
export type EegData = typeof eegData.$inferSelect;

export interface BrainwaveData {
  attention: number;
  meditation: number;
  signalQuality: number;
  timestamp: number;
}

export interface GenerateMandalaRequest {
  voiceTranscript: string;
  brainwaveData: BrainwaveData;
  sessionId: string;
}
