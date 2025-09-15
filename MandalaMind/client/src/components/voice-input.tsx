import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square, Edit3 } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

interface VoiceInputProps {
  onTranscriptChange: (transcript: string) => void;
  onGenerateMandala: (transcript: string) => void;
  isGenerating: boolean;
  resetTrigger?: number; // Increment to trigger reset
}

export function VoiceInput({ onTranscriptChange, onGenerateMandala, isGenerating, resetTrigger }: VoiceInputProps) {
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error
  } = useSpeechRecognition();

  const [hasStartedRecording, setHasStartedRecording] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  // Effective transcript combines speech recognition and manual text
  const effectiveTranscript = isManualMode ? manualText : transcript;

  // Update parent component when transcript changes
  useEffect(() => {
    onTranscriptChange(effectiveTranscript);
  }, [effectiveTranscript, onTranscriptChange]);

  // Handle external reset trigger
  useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      // Stop listening if currently active
      if (isListening) {
        stopListening();
      }
      // Clear all transcript data
      resetTranscript();
      setManualText('');
      setHasStartedRecording(false);
      setIsManualMode(false);
    }
  }, [resetTrigger, isListening, stopListening, resetTranscript]);

  const handleToggleRecording = () => {
    if (isListening) {
      stopListening();
    } else {
      if (!hasStartedRecording) {
        setHasStartedRecording(true);
        resetTranscript();
      }
      startListening();
    }
  };

  const handleGenerateMandala = () => {
    if (effectiveTranscript.trim()) {
      onGenerateMandala(effectiveTranscript.trim());
      onTranscriptChange(effectiveTranscript.trim());
    }
  };

  const handleClearTranscript = () => {
    resetTranscript();
    setManualText('');
    onTranscriptChange('');
    setHasStartedRecording(false);
    setIsManualMode(false);
  };

  const handleManualTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setManualText(e.target.value);
    setIsManualMode(true);
  };

  const toggleManualMode = () => {
    setIsManualMode(!isManualMode);
    if (!isManualMode) {
      setManualText(transcript || '');
    } else {
      resetTranscript();
    }
  };

  if (!isSupported) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <MicOff className="text-destructive mr-3 h-5 w-5" />
            Voice Input
          </h3>
          <div className="text-center py-8">
            <p className="text-muted-foreground" data-testid="text-unsupported-browser">
              Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Mic className="text-secondary mr-3 h-5 w-5" />
          Voice Input
        </h3>
        
        <div className="space-y-4">
          {/* Recording Button */}
          <div className="text-center">
            <Button
              onClick={handleToggleRecording}
              disabled={isGenerating}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-3 sm:mb-4 transition-all duration-200 touch-manipulation ${
                isListening 
                  ? 'bg-destructive hover:bg-destructive/80 animate-pulse' 
                  : 'bg-gradient-to-r from-secondary to-accent hover:scale-105 active:scale-95'
              }`}
              data-testid="button-toggle-recording"
            >
              {isListening ? (
                <Square className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
              ) : (
                <Mic className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
              )}
            </Button>
            <p className="text-sm text-muted-foreground px-4" data-testid="text-recording-instruction">
              {isListening ? 'Tap to stop recording' : 'Tap to start speaking'}
            </p>
          </div>

          {/* Voice Transcript / Manual Input */}
          <div className="bg-secondary/30 rounded-lg p-4 min-h-[120px] relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">
                {isManualMode ? 'Texto Manual:' : 'Transcript:'}
              </div>
              <Button
                onClick={toggleManualMode}
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                data-testid="button-toggle-manual-mode"
              >
                <Edit3 className="w-3 h-3 mr-1" />
                {isManualMode ? 'Voz' : 'Texto'}
              </Button>
            </div>
            
            {isManualMode ? (
              <textarea
                value={manualText}
                onChange={handleManualTextChange}
                className="w-full min-h-[60px] bg-transparent border-none outline-none resize-none text-foreground"
                placeholder="Digite seus pensamentos, sentimentos ou intenções..."
                data-testid="textarea-manual-input"
              />
            ) : (
              <div 
                className="text-foreground min-h-[60px] whitespace-pre-wrap"
                data-testid="text-transcript"
              >
                {transcript || (hasStartedRecording ? 'Listening...' : 'Click the microphone to start speaking')}
              </div>
            )}
            
            {isListening && !isManualMode && (
              <div className="flex items-center mt-3 space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-muted-foreground" data-testid="text-listening-indicator">
                  Listening...
                </span>
              </div>
            )}

            {error && !isManualMode && (
              <div className="mt-2 text-sm text-destructive" data-testid="text-speech-error">
                {error}
                <div className="text-xs text-muted-foreground mt-1">
                  Clique no botão "Texto" acima para inserir texto manualmente
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleGenerateMandala}
              disabled={!effectiveTranscript.trim() || isGenerating || (isListening && !isManualMode)}
              className="flex-1 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 touch-manipulation min-h-[44px]"
              data-testid="button-generate-mandala"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <div className="w-4 h-4 mr-2">✨</div>
                  Generate Mandala
                </>
              )}
            </Button>

            {effectiveTranscript && (
              <Button
                onClick={handleClearTranscript}
                disabled={isGenerating || (isListening && !isManualMode)}
                variant="outline"
                className="w-full sm:w-auto touch-manipulation min-h-[44px]"
                data-testid="button-clear-transcript"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Tips */}
          {!hasStartedRecording && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground" data-testid="text-voice-tips">
                💡 <strong>Tips:</strong> Speak about your feelings, thoughts, or intentions. 
                The AI will combine your words with your brain waves to create a unique mandala.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
