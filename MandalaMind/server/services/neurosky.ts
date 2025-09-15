import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { BrainwaveData } from '@shared/schema';

export interface NeuroSkyConfig {
  port?: string;
  baudRate?: number;
  autoConnect?: boolean;
  demoMode?: boolean;
}

export class NeuroSkyService extends EventEmitter {
  private socket: WebSocket | null = null;
  private isConnected = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private currentData: BrainwaveData | null = null;
  private demoInterval: NodeJS.Timeout | null = null;
  private isDemoMode = false;

  constructor(private config: NeuroSkyConfig = {}) {
    super();
    this.config = {
      port: '/dev/ttyUSB0', // Default for Linux, adjust for Windows (COM ports)
      baudRate: 9600,
      autoConnect: false, // Disabled auto-connect to prevent server-side connection attempts
      demoMode: false,
      ...config
    };
    this.isDemoMode = this.config.demoMode || false;
  }

  async connect(): Promise<void> {
    try {
      // If in demo mode, start simulation instead of real connection
      if (this.isDemoMode) {
        this.startDemoMode();
        return;
      }

      // Connect to ThinkGear Connector (socket server)
      // Default ThinkGear Connector runs on localhost:13854
      this.socket = new WebSocket('ws://localhost:13854');
      
      this.socket.on('open', () => {
        console.log('Connected to NeuroSky ThinkGear Connector');
        this.isConnected = true;
        
        // Configure the connection for JSON format
        const config = {
          enableRawOutput: false,
          format: "Json"
        };
        
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify(config));
        }
        
        this.emit('connected');
      });

      this.socket.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleThinkGearMessage(message);
        } catch (error) {
          console.error('Error parsing ThinkGear message:', error);
        }
      });

      this.socket.on('close', () => {
        console.log('NeuroSky connection closed');
        this.isConnected = false;
        this.emit('disconnected');
        
        if (this.config.autoConnect) {
          this.scheduleReconnect();
        }
      });

      this.socket.on('error', (error) => {
        console.error('NeuroSky connection error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Failed to connect to NeuroSky:', error);
      throw error;
    }
  }

  private handleThinkGearMessage(message: any): void {
    // ThinkGear JSON format includes eSense values and signal quality
    const data: Partial<BrainwaveData> = {};

    if (message.eSense) {
      data.attention = message.eSense.attention || 0;
      data.meditation = message.eSense.meditation || 0;
    }

    if (message.poorSignalLevel !== undefined) {
      // Convert poor signal level to signal quality (inverse)
      data.signalQuality = Math.max(0, 100 - (message.poorSignalLevel * 100 / 200));
    }

    if (data.attention !== undefined || data.meditation !== undefined || data.signalQuality !== undefined) {
      this.currentData = {
        attention: data.attention || this.currentData?.attention || 0,
        meditation: data.meditation || this.currentData?.meditation || 0,
        signalQuality: data.signalQuality || this.currentData?.signalQuality || 0,
        timestamp: Date.now()
      };

      this.emit('data', this.currentData);
    }

    // Handle blink detection
    if (message.blinkStrength) {
      this.emit('blink', { strength: message.blinkStrength });
    }

    // Handle raw EEG data if enabled
    if (message.rawEeg) {
      this.emit('rawEeg', { value: message.rawEeg, timestamp: Date.now() });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
    }

    // Only attempt reconnection if auto-connect is enabled
    if (this.config.autoConnect) {
      this.reconnectInterval = setTimeout(() => {
        console.log('Attempting to reconnect to NeuroSky...');
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, 5000); // Retry every 5 seconds
    }
  }

  disconnect(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isConnected = false;
    this.isDemoMode = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getCurrentData(): BrainwaveData | null {
    return this.currentData;
  }

  enableDemoMode(): void {
    this.isDemoMode = true;
    this.config.demoMode = true;
  }

  disableDemoMode(): void {
    this.isDemoMode = false;
    this.config.demoMode = false;
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.disconnect();
  }

  private startDemoMode(): void {
    console.log('Starting NeuroSky demo mode');
    this.isConnected = true;
    this.emit('connected');

    // Generate realistic demo data every 250ms (4Hz)
    this.demoInterval = setInterval(() => {
      this.generateDemoData();
    }, 250);
  }

  private generateDemoData(): void {
    // Generate realistic brainwave data with natural fluctuations
    const time = Date.now() / 1000;
    
    // Base values that change slowly over time
    const baseAttention = 30 + 30 * Math.sin(time * 0.01) + 15 * Math.sin(time * 0.03);
    const baseMeditation = 25 + 35 * Math.cos(time * 0.008) + 20 * Math.cos(time * 0.02);
    
    // Add realistic noise and fluctuations
    const attention = Math.max(0, Math.min(100, Math.round(
      baseAttention + 10 * (Math.random() - 0.5) + 5 * Math.sin(time * 0.1)
    )));
    
    const meditation = Math.max(0, Math.min(100, Math.round(
      baseMeditation + 8 * (Math.random() - 0.5) + 7 * Math.cos(time * 0.12)
    )));
    
    // Signal quality varies realistically
    const signalQuality = Math.max(60, Math.min(100, Math.round(
      85 + 10 * Math.sin(time * 0.005) + 5 * (Math.random() - 0.5)
    )));

    this.currentData = {
      attention,
      meditation,
      signalQuality,
      timestamp: Date.now()
    };

    this.emit('data', this.currentData);

    // Occasionally emit blink events
    if (Math.random() < 0.02) { // 2% chance per update
      this.emit('blink', { strength: Math.round(20 + 30 * Math.random()) });
    }
  }

  // Static method to check if ThinkGear Connector is available
  static async checkThinkGearConnector(): Promise<boolean> {
    try {
      const testSocket = new WebSocket('ws://localhost:13854');
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          testSocket.close();
          resolve(false);
        }, 3000);

        testSocket.on('open', () => {
          clearTimeout(timeout);
          testSocket.close();
          resolve(true);
        });

        testSocket.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }
}
