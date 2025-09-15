import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Share2, Palette } from "lucide-react";
import QRCode from 'qrcode';

interface GeneratedMandala {
  id?: string;
  imageUrl: string;
  prompt: string;
  revisedPrompt?: string;
  generationTime?: number;
}

interface MandalaDisplayProps {
  mandala: GeneratedMandala | null;
  isGenerating: boolean;
  generationStatus: 'idle' | 'generating' | 'completed' | 'error';
  error?: string;
}

export function MandalaDisplay({ mandala, isGenerating, generationStatus, error }: MandalaDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // Generate QR code when mandala is available
  useEffect(() => {
    if (mandala?.id) {
      // Create shareable URL for the mandala
      const baseUrl = window.location.origin;
      const shareableUrl = `${baseUrl}/api/mandalas/${mandala.id}/image`;
      
      QRCode.toDataURL(shareableUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).then((url: string) => {
        setQrCodeUrl(url);
      }).catch((err: any) => {
        console.error('Error generating QR code:', err);
      });
    } else {
      setQrCodeUrl('');
    }
  }, [mandala?.id]);

  const handleDownload = async () => {
    if (!mandala?.id) return;

    try {
      // Use shareable route for consistent behavior and proper headers
      const baseUrl = window.location.origin;
      const shareableUrl = `${baseUrl}/api/mandalas/${mandala.id}/image`;
      
      const response = await fetch(shareableUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mandala-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const handleShare = async () => {
    if (!mandala?.id) return;

    // Create shareable URL for the mandala
    const baseUrl = window.location.origin;
    const shareableUrl = `${baseUrl}/api/mandalas/${mandala.id}/image`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Mind Mandala',
          text: 'Check out this mandala created from my brain waves and thoughts!',
          url: shareableUrl
        });
      } catch (error) {
        console.error('Error sharing:', error);
        // Fallback to clipboard
        navigator.clipboard.writeText(shareableUrl);
      }
    } else {
      // Fallback for browsers without native share
      navigator.clipboard.writeText(shareableUrl);
    }
  };

  return (
    <Card className="glass border-border/50 mandala-container">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Palette className="text-accent mr-3 h-5 w-5" />
          Generated Mandala
        </h3>
        
        {/* Mandala Image Container */}
        <div className="aspect-square bg-secondary/30 rounded-lg flex items-center justify-center mb-6 overflow-hidden relative">
          {isGenerating ? (
            <div className="flex flex-col items-center space-y-4" data-testid="div-generating">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Creating your mandala...</p>
            </div>
          ) : mandala?.imageUrl ? (
            <img 
              src={mandala.imageUrl}
              alt="Generated mandala based on brain waves and voice input" 
              className="w-full h-full object-cover rounded-lg"
              data-testid="img-generated-mandala"
            />
          ) : error ? (
            <div className="text-center p-8" data-testid="div-error-state">
              <div className="text-destructive mb-2">⚠️</div>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          ) : (
            <div className="text-center p-8" data-testid="div-empty-state">
              <div className="text-6xl mb-4">🎨</div>
              <p className="text-muted-foreground">Your mandala will appear here</p>
              <p className="text-sm text-muted-foreground mt-2">
                Start recording your voice to generate your first mandala
              </p>
            </div>
          )}
        </div>

        {/* Generation Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              generationStatus === 'completed' ? 'bg-green-500' :
              generationStatus === 'generating' ? 'bg-yellow-500 animate-pulse' :
              generationStatus === 'error' ? 'bg-red-500' :
              'bg-gray-500'
            }`} />
            <span className="text-sm text-muted-foreground" data-testid="text-generation-status">
              {generationStatus === 'completed' ? 'Generation completed' :
               generationStatus === 'generating' ? 'Generating...' :
               generationStatus === 'error' ? 'Generation failed' :
               'Ready to generate'}
            </span>
          </div>
          {mandala && (
            <span className="text-xs text-muted-foreground" data-testid="text-generation-time">
              {mandala.generationTime ? `${mandala.generationTime}s` : ''}
            </span>
          )}
        </div>

        {/* AI Prompt Used */}
        {mandala?.prompt && (
          <div className="bg-secondary/30 rounded-lg p-4 mb-6">
            <div className="text-sm text-muted-foreground mb-2">AI Prompt Generated:</div>
            <div className="text-sm text-foreground line-clamp-4" data-testid="text-generated-prompt">
              {mandala.revisedPrompt || mandala.prompt}
            </div>
          </div>
        )}

        {/* Download Options */}
        {mandala && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* QR Code */}
            <div className="bg-secondary/30 rounded-lg p-4 text-center order-2 sm:order-1">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 bg-white rounded-lg flex items-center justify-center">
                {qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt="QR code for mandala download" 
                    className="w-full h-full rounded-lg"
                    data-testid="img-qr-code"
                  />
                ) : (
                  <div className="text-gray-400" data-testid="div-qr-loading">
                    Loading...
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Scan to download</p>
            </div>

            {/* Direct Actions */}
            <div className="space-y-2 order-1 sm:order-2">
              <Button 
                onClick={handleDownload}
                className="w-full bg-accent hover:bg-accent/80 text-accent-foreground touch-manipulation min-h-[44px]"
                data-testid="button-download-mandala"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button 
                onClick={handleShare}
                variant="outline"
                className="w-full touch-manipulation min-h-[44px]"
                data-testid="button-share-mandala"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        )}

        {/* Generation Statistics */}
        {mandala && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="text-lg font-semibold text-primary" data-testid="text-total-generations">
                1
              </div>
              <div className="text-xs text-muted-foreground">Generated Today</div>
            </div>
            <div className="bg-secondary/10 rounded-lg p-3">
              <div className="text-lg font-semibold text-secondary" data-testid="text-session-time">
                {new Date().toLocaleTimeString()}
              </div>
              <div className="text-xs text-muted-foreground">Session Time</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
