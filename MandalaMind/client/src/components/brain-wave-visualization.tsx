import { useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity } from "lucide-react";
import { BrainwaveData } from '@shared/schema';

interface BrainWaveVisualizationProps {
  data: BrainwaveData | null;
}

export function BrainWaveVisualization({ data }: BrainWaveVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const dataPointsRef = useRef<number[]>([]);

  // Generate realistic EEG waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);
      
      // Generate wave data based on attention and meditation levels
      const baseFrequency = data ? (data.attention + data.meditation) / 100 : 0.5;
      const amplitude = data ? (data.signalQuality / 100) * (height / 4) : height / 8;
      
      // Add new data point
      const newPoint = Math.sin(Date.now() * 0.01 * baseFrequency) * amplitude + 
                      Math.sin(Date.now() * 0.02) * (amplitude * 0.3) +
                      (Math.random() - 0.5) * (amplitude * 0.2);
      
      dataPointsRef.current.push(newPoint);
      
      // Keep only the last 100 points
      if (dataPointsRef.current.length > 100) {
        dataPointsRef.current.shift();
      }
      
      // Draw the waveform
      ctx.strokeStyle = data ? '#8b5cf6' : '#6b7280'; // primary color if data available
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const stepX = width / (dataPointsRef.current.length - 1);
      
      dataPointsRef.current.forEach((point, index) => {
        const x = index * stepX;
        const y = height / 2 + point;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Add gradient overlay
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)');
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [data]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <Card className="glass border-border/50">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Activity className="text-primary mr-3 h-5 w-5" />
          Brain Activity
        </h3>
        
        <div className="space-y-4">
          {/* Attention Level */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Attention</span>
              <span 
                className="text-sm font-medium text-primary" 
                data-testid="text-attention-level"
              >
                {data?.attention || 0}%
              </span>
            </div>
            <Progress 
              value={data?.attention || 0} 
              className="h-2"
              data-testid="progress-attention"
            />
          </div>

          {/* Meditation Level */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Meditation</span>
              <span 
                className="text-sm font-medium text-secondary" 
                data-testid="text-meditation-level"
              >
                {data?.meditation || 0}%
              </span>
            </div>
            <Progress 
              value={data?.meditation || 0} 
              className="h-2"
              data-testid="progress-meditation"
            />
          </div>

          {/* Signal Quality */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Signal Quality</span>
              <span 
                className="text-sm font-medium text-accent" 
                data-testid="text-signal-quality"
              >
                {data?.signalQuality || 0}%
              </span>
            </div>
            <Progress 
              value={data?.signalQuality || 0} 
              className="h-2"
              data-testid="progress-signal-quality"
            />
          </div>
        </div>

        {/* Real-time EEG Wave Visualization */}
        <div className="mt-6">
          <div className="text-sm text-muted-foreground mb-2">EEG Waveform</div>
          <div className="h-24 bg-secondary/30 rounded-lg relative overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
              data-testid="canvas-eeg-waveform"
            />
            {!data && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                <span data-testid="text-no-signal">No signal</span>
              </div>
            )}
          </div>
        </div>

        {/* Data timestamp */}
        {data && (
          <div className="mt-2 text-xs text-muted-foreground text-right">
            <span data-testid="text-last-update">
              Last update: {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
