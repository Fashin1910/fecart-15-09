import { type Session, type InsertSession, type Mandala, type InsertMandala, type EegData, type InsertEegData } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Session management
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  updateSession(id: string, updates: Partial<InsertSession>): Promise<Session | undefined>;
  getActiveSessions(): Promise<Session[]>;

  // Mandala management
  createMandala(mandala: InsertMandala): Promise<Mandala>;
  getMandala(id: string): Promise<Mandala | undefined>;
  getMandalasForSession(sessionId: string): Promise<Mandala[]>;
  getRecentMandalas(limit: number): Promise<Mandala[]>;

  // EEG data management
  addEegData(data: InsertEegData): Promise<EegData>;
  getEegDataForSession(sessionId: string): Promise<EegData[]>;
  getLatestEegData(sessionId: string): Promise<EegData | undefined>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private mandalas: Map<string, Mandala>;
  private eegData: Map<string, EegData>;

  constructor() {
    this.sessions = new Map();
    this.mandalas = new Map();
    this.eegData = new Map();
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const session: Session = {
      ...insertSession,
      id,
      createdAt: new Date(),
      isActive: true,
      attentionLevel: insertSession.attentionLevel ?? null,
      meditationLevel: insertSession.meditationLevel ?? null,
      signalQuality: insertSession.signalQuality ?? null,
      voiceTranscript: insertSession.voiceTranscript ?? null,
      aiPrompt: insertSession.aiPrompt ?? null,
      mandalaUrl: insertSession.mandalaUrl ?? null,
    };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async updateSession(id: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updatedSession = { ...session, ...updates };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async getActiveSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  async createMandala(insertMandala: InsertMandala): Promise<Mandala> {
    const id = randomUUID();
    const mandala: Mandala = {
      ...insertMandala,
      id,
      createdAt: new Date(),
      sessionId: insertMandala.sessionId ?? null,
      voiceTranscript: insertMandala.voiceTranscript ?? null,
    };
    this.mandalas.set(id, mandala);
    return mandala;
  }

  async getMandala(id: string): Promise<Mandala | undefined> {
    return this.mandalas.get(id);
  }

  async getMandalasForSession(sessionId: string): Promise<Mandala[]> {
    return Array.from(this.mandalas.values()).filter(mandala => mandala.sessionId === sessionId);
  }

  async getRecentMandalas(limit: number): Promise<Mandala[]> {
    return Array.from(this.mandalas.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async addEegData(insertData: InsertEegData): Promise<EegData> {
    const id = randomUUID();
    const data: EegData = {
      ...insertData,
      id,
      timestamp: new Date(),
      sessionId: insertData.sessionId ?? null,
      rawData: insertData.rawData ?? null,
    };
    this.eegData.set(id, data);
    return data;
  }

  async getEegDataForSession(sessionId: string): Promise<EegData[]> {
    return Array.from(this.eegData.values())
      .filter(data => data.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getLatestEegData(sessionId: string): Promise<EegData | undefined> {
    const sessionData = await this.getEegDataForSession(sessionId);
    return sessionData[sessionData.length - 1];
  }
}

export const storage = new MemStorage();
