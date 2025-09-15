import { useEffect, useRef, useState, useCallback } from 'react';
import { BrainwaveData } from '@shared/schema';

export interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
  message?: string;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (message: any) => void;
  lastMessage: WebSocketMessage | null;
  eegData: BrainwaveData | null;
  neuroskyConnected: boolean;
  connectNeuroSky: () => void;
  disconnectNeuroSky: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [eegData, setEegData] = useState<BrainwaveData | null>(null);
  const [neuroskyConnected, setNeuroskyConnected] = useState(false);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          switch (message.type) {
            case 'eeg_data':
              if (message.data) {
                setEegData(message.data);
              }
              break;
            case 'neurosky_connected':
              setNeuroskyConnected(true);
              break;
            case 'neurosky_disconnected':
              setNeuroskyConnected(false);
              break;
            case 'connection_status':
              setNeuroskyConnected(message.data?.connected || false);
              if (message.data?.currentData) {
                setEegData(message.data.currentData);
              }
              break;
            case 'neurosky_error':
              console.error('NeuroSky error:', message.error);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setNeuroskyConnected(false);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  const connectNeuroSky = useCallback(() => {
    sendMessage({ type: 'connect_neurosky' });
  }, [sendMessage]);

  const disconnectNeuroSky = useCallback(() => {
    sendMessage({ type: 'disconnect_neurosky' });
  }, [sendMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    sendMessage,
    lastMessage,
    eegData,
    neuroskyConnected,
    connectNeuroSky,
    disconnectNeuroSky
  };
}
