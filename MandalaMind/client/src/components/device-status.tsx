import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Mic, Cloud, Plug, Cpu, AlertCircle, CheckCircle, Loader2, Zap } from "lucide-react";
import { UseWebSocketReturn } from "@/hooks/use-websocket";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DeviceStatusProps {
  websocket: UseWebSocketReturn;
  microphoneEnabled: boolean;
  onConnectNeuroSky: () => void;
  onDisconnectNeuroSky: () => void;
}

export function DeviceStatus({ 
  websocket, 
  microphoneEnabled, 
  onConnectNeuroSky, 
  onDisconnectNeuroSky 
}: DeviceStatusProps) {
  const { isConnected, neuroskyConnected, eegData } = websocket;
  const { toast } = useToast();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isTogglingDemo, setIsTogglingDemo] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');

  // Signal quality assessment
  const getSignalQuality = () => {
    if (!eegData) return { quality: 'No Signal', color: 'bg-gray-500', level: 0 };
    
    const signalQuality = eegData.signalQuality;
    if (signalQuality >= 80) return { quality: 'Excellent', color: 'bg-green-500', level: 5 };
    if (signalQuality >= 60) return { quality: 'Good', color: 'bg-green-400', level: 4 };
    if (signalQuality >= 40) return { quality: 'Fair', color: 'bg-yellow-500', level: 3 };
    if (signalQuality >= 20) return { quality: 'Poor', color: 'bg-orange-500', level: 2 };
    return { quality: 'Very Poor', color: 'bg-red-500', level: 1 };
  };

  // Enhanced connection handlers
  const handleConnect = () => {
    setIsConnecting(true);
    setConnectionError('');
    onConnectNeuroSky();
    
    // Set timeout for connection attempt
    setTimeout(() => {
      if (!neuroskyConnected) {
        setIsConnecting(false);
        setConnectionError('Connection timeout. Please check your NeuroSky headset is powered on and in pairing mode.');
      }
    }, 10000); // 10 second timeout
  };

  const handleDisconnect = () => {
    setConnectionError('');
    onDisconnectNeuroSky();
  };

  // Watch connection state changes
  useEffect(() => {
    if (neuroskyConnected) {
      setIsConnecting(false);
      setConnectionError('');
    } else if (isConnecting) {
      // Keep isConnecting true while attempting
    }
  }, [neuroskyConnected, isConnecting]);

  const handleDemoModeToggle = async (enabled: boolean) => {
    setIsTogglingDemo(true);
    try {
      const endpoint = enabled ? '/api/neurosky/demo/enable' : '/api/neurosky/demo/disable';
      await apiRequest('POST', endpoint, {});
      
      setIsDemoMode(enabled);
      toast({
        title: enabled ? "Demo Mode Enabled" : "Demo Mode Disabled",
        description: enabled 
          ? "Simulated brain wave data will be generated for testing" 
          : "Demo mode has been turned off",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle demo mode",
        variant: "destructive",
      });
    } finally {
      setIsTogglingDemo(false);
    }
  };

  return (
    <Card className="glass border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center">
            <Plug className="text-primary mr-3 h-5 w-5" />
            Device Status
          </h3>
          
          {neuroskyConnected ? (
            <Button 
              onClick={handleDisconnect}
              variant="outline" 
              size="sm"
              className="touch-manipulation min-h-[36px]"
              data-testid="button-disconnect-neurosky"
            >
              Disconnect
            </Button>
          ) : (
            <Button 
              onClick={handleConnect}
              variant="default" 
              size="sm"
              className="touch-manipulation min-h-[36px]"
              disabled={isConnecting}
              data-testid="button-connect-neurosky"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          )}
        </div>
        
        <div className="space-y-4">
          {/* Demo Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center space-x-3">
              <Cpu className="text-primary h-5 w-5" />
              <div>
                <span className="font-medium">Demo Mode</span>
                <p className="text-xs text-muted-foreground">Simulate brain waves for testing</p>
              </div>
            </div>
            <Switch
              checked={isDemoMode}
              onCheckedChange={handleDemoModeToggle}
              disabled={isTogglingDemo}
              data-testid="switch-demo-mode"
            />
          </div>

          {/* NeuroSky Connection */}
          <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Brain className="text-primary h-5 w-5" />
                <span data-testid="text-neurosky-label">
                  {isDemoMode ? 'Simulated Brain Waves' : 'NeuroSky Headset'}
                </span>
              </div>
              <Badge 
                variant={neuroskyConnected ? "default" : isConnecting ? "secondary" : "destructive"}
                data-testid="badge-neurosky-status"
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  neuroskyConnected ? 'bg-green-500' : 
                  isConnecting ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                {neuroskyConnected ? (isDemoMode ? 'Simulating' : 'Connected') : 
                 isConnecting ? 'Connecting...' : 'Disconnected'}
              </Badge>
            </div>

            {/* Signal Quality Indicator */}
            {neuroskyConnected && eegData && (
              <div className="flex items-center space-x-2 text-xs">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Signal Quality:</span>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${getSignalQuality().color}`} />
                  <span className="font-medium">{getSignalQuality().quality}</span>
                  <span className="text-muted-foreground">({eegData.signalQuality}%)</span>
                </div>
              </div>
            )}
          </div>

          {/* Connection Error Alert */}
          {connectionError && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-sm">
                <div className="font-medium mb-1">Connection Issue</div>
                {connectionError}
                <div className="mt-2 text-xs text-muted-foreground">
                  💡 <strong>Troubleshooting:</strong> Ensure your NeuroSky headset is powered on, 
                  in pairing mode, and not connected to other devices. Try moving closer to your computer.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Tips for Disconnected State */}
          {!neuroskyConnected && !isConnecting && !connectionError && (
            <Alert className="border-primary/50 bg-primary/10">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                <div className="font-medium mb-1">Ready to Connect</div>
                Make sure your NeuroSky headset is powered on and in pairing mode before clicking Connect.
                <div className="mt-1 text-xs text-muted-foreground">
                  💡 The LED should be blinking blue when ready to pair.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* WebSocket Connection */}
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <Cloud className="text-secondary h-5 w-5" />
              <span data-testid="text-websocket-label">WebSocket</span>
            </div>
            <Badge 
              variant={isConnected ? "default" : "destructive"}
              data-testid="badge-websocket-status"
            >
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          {/* Mic Status */}
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <Mic className="text-accent h-5 w-5" />
              <span data-testid="text-microphone-label">Mic</span>
            </div>
            <Badge 
              variant={microphoneEnabled ? "default" : "secondary"}
              data-testid="badge-microphone-status"
            >
              <div className={`w-2 h-2 rounded-full mr-2 ${
                microphoneEnabled ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              {microphoneEnabled ? 'Ready' : 'Permission Needed'}
            </Badge>
          </div>

          {/* API Services */}
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <Cloud className="text-primary h-5 w-5" />
              <span data-testid="text-api-label">AI Services</span>
            </div>
            <Badge variant="default" data-testid="badge-api-status">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              Ready
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
