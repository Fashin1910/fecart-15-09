import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeviceStatus } from '@/components/device-status';
import { BrainWaveVisualization } from '@/components/brain-wave-visualization';
import { VoiceInput } from '@/components/voice-input';
import { MandalaDisplay } from '@/components/mandala-display';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { RotateCcw } from 'lucide-react';
import type { Mandala, Session, BrainwaveData } from '@shared/schema';

interface GenerateMandalaResponse {
  mandala: Mandala;
  generatedPrompt: string;
  imageUrl: string;
  revisedPrompt?: string;
}

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const websocket = useWebSocket();
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [generatedMandala, setGeneratedMandala] = useState<any>(null);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
  const [generationError, setGenerationError] = useState<string>('');
  const [resetTrigger, setResetTrigger] = useState(0);

  // Create session on component mount
  useEffect(() => {
    const createSession = async () => {
      try {
        const response = await apiRequest('POST', '/api/sessions', {
          attentionLevel: 0,
          meditationLevel: 0,
          signalQuality: 0
        });
        const session = await response.json();
        setCurrentSession(session);
      } catch (error) {
        console.error('Failed to create session:', error);
        toast({
          title: "Session Error",
          description: "Failed to create session. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    createSession();
  }, [toast]);

  // Fetch recent mandalas
  const { data: recentMandalas } = useQuery<Mandala[]>({
    queryKey: ['/api/mandalas/recent'],
    enabled: true
  });

  // Generate mandala mutation
  const generateMandalaMutation = useMutation({
    mutationFn: async (data: {
      voiceTranscript: string;
      brainwaveData: BrainwaveData;
      sessionId: string;
    }) => {
      const response = await apiRequest('POST', '/api/mandalas/generate', data);
      return response.json() as Promise<GenerateMandalaResponse>;
    },
    onMutate: () => {
      setGenerationStatus('generating');
      setGenerationError('');
    },
    onSuccess: (data) => {
      setGeneratedMandala({
        id: data.mandala.id,
        imageUrl: data.mandala.imageUrl,
        prompt: data.generatedPrompt,
        revisedPrompt: data.revisedPrompt,
        generationTime: 3.2 // This would come from the API in a real implementation
      });
      setGenerationStatus('completed');
      
      // Invalidate and refetch recent mandalas
      queryClient.invalidateQueries({ queryKey: ['/api/mandalas/recent'] });
      
      toast({
        title: "Mandala Generated! ✨",
        description: "Your personalized mandala has been created based on your thoughts and brain waves.",
      });
    },
    onError: (error) => {
      setGenerationStatus('error');
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate mandala');
      
      toast({
        title: "Generation Failed",
        description: "Sorry, we couldn't generate your mandala. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleGenerateMandala = (transcript: string) => {
    if (!currentSession) {
      toast({
        title: "Session Required",
        description: "Please wait for the session to initialize.",
        variant: "destructive",
      });
      return;
    }

    if (!websocket.eegData) {
      toast({
        title: "No Brain Wave Data",
        description: "Please connect your NeuroSky headset first.",
        variant: "destructive",
      });
      return;
    }

    generateMandalaMutation.mutate({
      voiceTranscript: transcript,
      brainwaveData: websocket.eegData,
      sessionId: currentSession.id
    });
  };

  const handleConnectNeuroSky = () => {
    websocket.connectNeuroSky();
    toast({
      title: "Connecting to NeuroSky...",
      description: "Please ensure your headset is powered on and paired via Bluetooth.",
    });
  };

  const handleDisconnectNeuroSky = () => {
    websocket.disconnectNeuroSky();
    toast({
      title: "Disconnected",
      description: "NeuroSky headset has been disconnected.",
    });
  };

  const handleReset = async () => {
    try {
      // Clear all local state
      setCurrentTranscript('');
      setGeneratedMandala(null);
      setGenerationStatus('idle');
      setGenerationError('');

      // Trigger voice input reset (stop recording and clear transcript)
      setResetTrigger(prev => prev + 1);

      // Clear all query cache
      queryClient.clear();

      // Create a new session
      const response = await apiRequest('POST', '/api/sessions', {
        attentionLevel: 0,
        meditationLevel: 0,
        signalQuality: 0
      });
      const newSession = await response.json();
      setCurrentSession(newSession);

      toast({
        title: "Reset Complete",
        description: "All data cleared and new session created. Ready for a fresh start!",
      });
    } catch (error) {
      console.error('Failed to reset session:', error);
      toast({
        title: "Reset Error",
        description: "Failed to complete reset. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Particle Background */}
      <div className="particles fixed inset-0 z-0">
        {Array.from({ length: 9 }, (_, i) => (
          <div 
            key={i}
            className="particle absolute w-0.5 h-0.5 bg-primary/60 rounded-full"
            style={{
              left: `${(i + 1) * 10}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: '6s',
              animationName: 'particle-float',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear'
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 bg-card/50 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-xl">🧠</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                MindMandala
              </h1>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Gallery</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Settings</a>
            </nav>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full glass">
                <div className={`w-2 h-2 rounded-full ${
                  websocket.neuroskyConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-xs text-muted-foreground">NeuroSky</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4 sm:mb-6 px-2">
              Transform Your
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                {" "}Mind{" "}
              </span>
              into Art
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed max-w-3xl mx-auto px-4">
              Connect your NeuroSky headset, speak your thoughts, and watch as AI creates unique mandalas based on your brain waves and voice.
            </p>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 mb-8 lg:mb-12">
            {/* Left Column: Controls and Status */}
            <div className="space-y-4 lg:space-y-6">
              <DeviceStatus
                websocket={websocket}
                microphoneEnabled={true}
                onConnectNeuroSky={handleConnectNeuroSky}
                onDisconnectNeuroSky={handleDisconnectNeuroSky}
              />

              <BrainWaveVisualization data={websocket.eegData} />

              <VoiceInput
                onTranscriptChange={setCurrentTranscript}
                onGenerateMandala={handleGenerateMandala}
                isGenerating={generateMandalaMutation.isPending}
                resetTrigger={resetTrigger}
              />

              {/* Reset Button */}
              {(generatedMandala || currentTranscript) && (
                <Card className="glass border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">Start Fresh</h3>
                        <p className="text-xs text-muted-foreground">Clear all data and begin a new session</p>
                      </div>
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        size="sm"
                        className="ml-4 hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                        data-testid="button-reset-session"
                        disabled={generateMandalaMutation.isPending}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Mandala Display */}
            <div className="space-y-4 lg:space-y-6">
              <MandalaDisplay
                mandala={generatedMandala}
                isGenerating={generateMandalaMutation.isPending}
                generationStatus={generationStatus}
                error={generationError}
              />

              {/* Recent Creations */}
              {recentMandalas && recentMandalas.length > 0 && (
                <Card className="glass border-border/50">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <span className="text-primary mr-3">🎨</span>
                      Recent Creations
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      {recentMandalas.slice(0, 6).map((mandala: Mandala) => (
                        <div 
                          key={mandala.id}
                          className="aspect-square bg-secondary/30 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                          data-testid={`img-recent-mandala-${mandala.id}`}
                        >
                          <img 
                            src={mandala.imageUrl}
                            alt="Previous mandala creation" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* How It Works Section */}
          <section className="py-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                How It <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Works</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Experience the fusion of neuroscience and AI to create personalized spiritual art
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Step 1 */}
              <Card className="glass border-border/50 text-center p-6 lg:p-8">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl text-primary-foreground">🧠</span>
                </div>
                <h3 className="text-xl font-semibold mb-4">Connect Your Mind</h3>
                <p className="text-muted-foreground">
                  Put on your NeuroSky headset and establish a connection to start reading your brain waves in real-time.
                </p>
              </Card>

              {/* Step 2 */}
              <Card className="glass border-border/50 text-center p-6 lg:p-8">
                <div className="w-16 h-16 bg-gradient-to-r from-secondary to-accent rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl text-primary-foreground">🎤</span>
                </div>
                <h3 className="text-xl font-semibold mb-4">Express Your Thoughts</h3>
                <p className="text-muted-foreground">
                  Speak about your feelings, intentions, or anything that comes to mind while your brain activity is recorded.
                </p>
              </Card>

              {/* Step 3 */}
              <Card className="glass border-border/50 text-center p-6 lg:p-8">
                <div className="w-16 h-16 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl text-primary-foreground">🎨</span>
                </div>
                <h3 className="text-xl font-semibold mb-4">Generate Art</h3>
                <p className="text-muted-foreground">
                  AI combines your brain waves and voice to create a unique mandala that reflects your mental state and thoughts.
                </p>
              </Card>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card/50 backdrop-blur-sm border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground">🧠</span>
                </div>
                <h3 className="text-xl font-bold">MindMandala</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Transform your thoughts and brain waves into beautiful, personalized mandala art using cutting-edge AI technology.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <span className="text-xl">🐦</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <span className="text-xl">📧</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <span className="text-xl">💬</span>
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Tutorials</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Community</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2025 MindMandala. All rights reserved. Made with ♥ for consciousness explorers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
