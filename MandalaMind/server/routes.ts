import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { NeuroSkyService } from "./services/neurosky";
import { openaiService } from "./services/openai";
import { insertSessionSchema, insertMandalaSchema, type GenerateMandalaRequest, type BrainwaveData } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize NeuroSky service with auto-connect disabled
  const neuroskyService = new NeuroSkyService({ autoConnect: false });
  
  // WebSocket server for real-time EEG data streaming
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();
  
  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    clients.add(ws);
    
    // Send current connection status
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'connection_status',
        connected: neuroskyService.getConnectionStatus(),
        currentData: neuroskyService.getCurrentData()
      }));
    }
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'connect_neurosky':
            try {
              await neuroskyService.connect();
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to connect to NeuroSky device'
              }));
            }
            break;
            
          case 'disconnect_neurosky':
            neuroskyService.disconnect();
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  // Broadcast function for real-time data
  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // NeuroSky event handlers
  neuroskyService.on('connected', () => {
    broadcast({ type: 'neurosky_connected' });
  });
  
  neuroskyService.on('disconnected', () => {
    broadcast({ type: 'neurosky_disconnected' });
  });
  
  neuroskyService.on('data', async (data: BrainwaveData) => {
    broadcast({ type: 'eeg_data', data });
    
    // Store EEG data for active sessions
    try {
      const activeSessions = await storage.getActiveSessions();
      for (const session of activeSessions) {
        await storage.addEegData({
          sessionId: session.id,
          attention: data.attention,
          meditation: data.meditation,
          signalQuality: data.signalQuality,
          rawData: data
        });
      }
    } catch (error) {
      console.error('Error storing EEG data:', error);
    }
  });
  
  neuroskyService.on('error', (error) => {
    broadcast({ type: 'neurosky_error', error: error.message });
  });
  
  // API Routes
  
  // Create a new session
  app.post("/api/sessions", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.parse(req.body);
      const session = await storage.createSession(validatedData);
      res.json(session);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Invalid session data' 
      });
    }
  });
  
  // Get session by ID
  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get session' 
      });
    }
  });
  
  // Update session
  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const updates = insertSessionSchema.partial().parse(req.body);
      const session = await storage.updateSession(req.params.id, updates);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Invalid update data' 
      });
    }
  });
  
  // Get recent mandalas
  app.get("/api/mandalas/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      const mandalas = await storage.getRecentMandalas(limit);
      res.json(mandalas);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get mandalas' 
      });
    }
  });
  
  // Get mandala by ID
  app.get("/api/mandalas/:id", async (req, res) => {
    try {
      const mandala = await storage.getMandala(req.params.id);
      if (!mandala) {
        return res.status(404).json({ error: 'Mandala not found' });
      }
      res.json(mandala);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get mandala' 
      });
    }
  });

  // Serve mandala image directly
  app.get("/api/mandalas/:id/image", async (req, res) => {
    try {
      const mandala = await storage.getMandala(req.params.id);
      if (!mandala) {
        return res.status(404).json({ error: 'Mandala not found' });
      }

      // Handle data URLs (locally generated SVG mandalas)
      if (mandala.imageUrl.startsWith('data:')) {
        const [header, base64Data] = mandala.imageUrl.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/svg+xml';
        
        const buffer = Buffer.from(base64Data, 'base64');
        
        res.set({
          'Content-Type': mimeType,
          'Content-Length': buffer.length,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'ETag': `"${req.params.id}"`
        });
        
        res.send(buffer);
      } else {
        // Handle external URLs (OpenAI generated images) - redirect
        res.redirect(302, mandala.imageUrl);
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to serve mandala image' 
      });
    }
  });
  
  // Generate mandala
  app.post("/api/mandalas/generate", async (req, res) => {
    try {
      const generateSchema = z.object({
        voiceTranscript: z.string().min(1, "Voice transcript is required"),
        brainwaveData: z.object({
          attention: z.number().min(0).max(100),
          meditation: z.number().min(0).max(100),
          signalQuality: z.number().min(0).max(100),
          timestamp: z.number()
        }),
        sessionId: z.string(),
        style: z.enum(['traditional', 'modern', 'abstract', 'spiritual']).optional(),
        colorPalette: z.enum(['warm', 'cool', 'vibrant', 'monochrome']).optional()
      });
      
      const data = generateSchema.parse(req.body);
      
      // Verify session exists
      const session = await storage.getSession(data.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Generate AI prompt
      const prompt = await openaiService.generateMandalaPrompt({
        voiceTranscript: data.voiceTranscript,
        brainwaveData: data.brainwaveData,
        style: data.style,
        colorPalette: data.colorPalette
      });
      
      // Generate mandala image
      const generatedMandala = await openaiService.generateMandalaImage(prompt, data.brainwaveData);
      
      // Store mandala
      const mandala = await storage.createMandala({
        sessionId: data.sessionId,
        imageUrl: generatedMandala.imageUrl,
        prompt: generatedMandala.prompt,
        brainwaveData: data.brainwaveData,
        voiceTranscript: data.voiceTranscript
      });
      
      // Update session with latest data
      await storage.updateSession(data.sessionId, {
        voiceTranscript: data.voiceTranscript,
        aiPrompt: prompt,
        mandalaUrl: generatedMandala.imageUrl,
        attentionLevel: data.brainwaveData.attention,
        meditationLevel: data.brainwaveData.meditation,
        signalQuality: data.brainwaveData.signalQuality
      });
      
      // Broadcast to connected clients
      broadcast({
        type: 'mandala_generated',
        mandala,
        generatedMandala
      });
      
      res.json({
        mandala,
        generatedPrompt: prompt,
        imageUrl: generatedMandala.imageUrl,
        revisedPrompt: generatedMandala.revisedPrompt
      });
      
    } catch (error: any) {
      console.error('Error generating mandala:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to generate mandala';
      let errorCode = 500;
      
      if (error?.code === 'insufficient_quota' || error?.code === 'billing_hard_limit_reached') {
        errorMessage = 'Problema com a conta da API OpenAI. Gerando mandala alternativa...';
        errorCode = 503; // Service temporarily unavailable
      } else if (error?.status === 429) {
        errorMessage = 'Muitas solicitações. Tente novamente em alguns minutos.';
        errorCode = 429;
      } else if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
        errorMessage = 'Problema de conexão. Tente novamente.';
        errorCode = 502; // Bad gateway
      }
      
      res.status(errorCode).json({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
        fallbackAvailable: true
      });
    }
  });
  
  // Get EEG data for session
  app.get("/api/sessions/:id/eeg", async (req, res) => {
    try {
      const eegData = await storage.getEegDataForSession(req.params.id);
      res.json(eegData);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get EEG data' 
      });
    }
  });
  
  // Get current NeuroSky status
  app.get("/api/neurosky/status", (req, res) => {
    res.json({
      connected: neuroskyService.getConnectionStatus(),
      currentData: neuroskyService.getCurrentData()
    });
  });
  
  // Connect to NeuroSky (alternative to WebSocket)
  app.post("/api/neurosky/connect", async (req, res) => {
    try {
      await neuroskyService.connect();
      res.json({ success: true, message: 'Connected to NeuroSky device' });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to connect to NeuroSky' 
      });
    }
  });
  
  // Disconnect from NeuroSky
  app.post("/api/neurosky/disconnect", (req, res) => {
    neuroskyService.disconnect();
    res.json({ success: true, message: 'Disconnected from NeuroSky device' });
  });
  
  // Check if ThinkGear Connector is available
  app.get("/api/neurosky/check", async (req, res) => {
    try {
      const available = await NeuroSkyService.checkThinkGearConnector();
      res.json({ available });
    } catch (error) {
      res.json({ available: false });
    }
  });

  // Enable demo mode
  app.post("/api/neurosky/demo/enable", (req, res) => {
    try {
      neuroskyService.enableDemoMode();
      res.json({ success: true, message: 'Demo mode enabled' });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to enable demo mode' 
      });
    }
  });

  // Disable demo mode
  app.post("/api/neurosky/demo/disable", (req, res) => {
    try {
      neuroskyService.disableDemoMode();
      res.json({ success: true, message: 'Demo mode disabled' });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to disable demo mode' 
      });
    }
  });
  
  return httpServer;
}
