import OpenAI from "openai";
import { BrainwaveData } from "@shared/schema";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR
});

export interface MandalaGenerationOptions {
  voiceTranscript: string;
  brainwaveData: BrainwaveData;
  style?: 'traditional' | 'modern' | 'abstract' | 'spiritual';
  colorPalette?: 'warm' | 'cool' | 'vibrant' | 'monochrome';
}

export interface GeneratedMandala {
  imageUrl: string;
  prompt: string;
  revisedPrompt?: string;
}

export class OpenAIService {
  
  async generateMandalaPrompt(options: MandalaGenerationOptions): Promise<string> {
    const { voiceTranscript, brainwaveData, style = 'spiritual', colorPalette = 'vibrant' } = options;
    
    // Try OpenAI first with retry logic
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        const response = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
          {
            role: "system",
            content: `You are an AI that creates detailed mandala generation prompts by analyzing brain wave data and voice transcripts. 

Create mandala prompts that reflect the beautiful traditional dot painting style with:
- Intricate concentric circles made of small dots in various sizes
- Deep blue background with radiating dotted patterns  
- Lotus-like flower patterns with detailed petal work
- Sacred geometric patterns using dot work technique
- White and light blue dots creating luminous effects against dark blue
- Multiple layers of circular patterns from center outward
- Traditional spiritual symbolism expressed through dot art

Your task is to create a beautiful, spiritually meaningful mandala prompt that reflects:
1. The person's mental state based on their brain waves
2. The emotional content and themes from their voice transcript
3. Traditional dot painting mandala style with intricate geometric patterns

Always respond in English regardless of the input language, as the image generation requires English prompts.`
          },
          {
            role: "user",
            content: `Please create a mandala generation prompt based on this data:

Voice Transcript: "${voiceTranscript}"

Brain Wave Data:
- Attention Level: ${brainwaveData.attention}% (0-100, higher = more focused)
- Meditation Level: ${brainwaveData.meditation}% (0-100, higher = more relaxed/meditative)
- Signal Quality: ${brainwaveData.signalQuality}% (connection quality)

Style Preference: ${style}
Color Palette: ${colorPalette}

Guidelines:
- High attention (>70%) = sharp, precise dot patterns, focused geometric energy
- High meditation (>70%) = flowing, soft dot gradients, peaceful circular patterns
- Balanced levels = harmonious, symmetrical dot work designs
- Low signal quality should be noted but not prevent generation

Extract emotional themes, spiritual concepts, and energy patterns from the voice transcript.
Incorporate traditional dot painting mandala elements:
- Concentric circles of dots in various sizes
- Sacred lotus patterns with dotted petals  
- Deep blue base with luminous white/light blue dots
- Radiating geometric patterns from center outward
- Multiple layers of intricate dot work
- Traditional spiritual symbolism expressed through dot art technique

Always create prompts in English for DALL-E compatibility, regardless of input language.

Respond with JSON: { "prompt": "detailed traditional dot painting mandala generation prompt in English" }`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 500
      });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        return result.prompt || this.getFallbackPrompt(options);
        
      } catch (error: any) {
        console.error(`Error generating mandala prompt (attempt ${attempt}):`, error);
        
        // Check if it's a quota/billing error
        if (error?.code === 'insufficient_quota' || error?.code === 'billing_hard_limit_reached' || error?.status === 429) {
          console.log(`API quota exceeded on attempt ${attempt}, falling back to local generation`);
          break; // Don't retry quota errors
        }
        
        // For other errors, wait before retrying
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
    }
    
    // Fallback to local prompt generation
    console.log('Using fallback prompt generation due to API issues');
    return this.getFallbackPrompt(options);
  }

  async generateMandalaImage(prompt: string, brainwaveData?: { attention: number, meditation: number, signalQuality: number }): Promise<GeneratedMandala> {
    const enhancedPrompt = `Create a detailed traditional dot painting mandala artwork: ${prompt}. 
    The mandala should be perfectly circular and symmetrical with intricate concentric circles made of small dots in various sizes. 
    Use a deep blue background with white and light blue luminous dots creating radiating patterns. 
    Include lotus-like flower patterns with detailed dotted petal work and sacred geometric patterns expressed through traditional dot art technique. 
    Multiple layers of circular dot patterns should radiate from center outward. 
    The style should be spiritual, meditative, and reminiscent of traditional Aboriginal dot painting techniques adapted for mandala art. 
    Ensure the mandala is perfectly centered and fills the entire circular frame.`;

    // Try OpenAI DALL-E with retry logic
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: enhancedPrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          style: "vivid"
        });

        if (!response.data?.[0]?.url) {
          throw new Error('No image URL received from OpenAI');
        }

        return {
          imageUrl: response.data[0].url,
          prompt: enhancedPrompt,
          revisedPrompt: response.data[0].revised_prompt
        };

      } catch (error: any) {
        console.error(`Error generating mandala image (attempt ${attempt}):`, error);
        
        // Check if it's a quota/billing error
        if (error?.code === 'insufficient_quota' || error?.code === 'billing_hard_limit_reached' || error?.status === 429 || error?.status === 400) {
          console.log(`API quota/billing issue on attempt ${attempt}, using fallback image generation`);
          break; // Don't retry quota errors
        }
        
        // For other errors, wait before retrying
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }
    }
    
    // Fallback to generated placeholder mandala
    console.log('Using fallback mandala generation due to API issues');
    return this.generateFallbackMandala(prompt, brainwaveData);
  }

  private generateFallbackMandala(prompt: string, brainwaveData?: { attention: number, meditation: number, signalQuality: number }): GeneratedMandala {
    // Create a data URL for a unique SVG mandala as fallback (no cache-buster for data URLs)
    const svgMandala = this.createSVGMandala(prompt, brainwaveData);
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgMandala).toString('base64')}`;
    
    return {
      imageUrl: dataUrl,
      prompt: prompt,
      revisedPrompt: `Fallback mandala generated locally with unique variations: ${prompt}`
    };
  }

  private createSVGMandala(prompt: string, brainwaveData?: { attention: number, meditation: number, signalQuality: number }): string {
    // Create a unique seed based on input to ensure variety
    const seed = this.createSeedFromInput(prompt, brainwaveData);
    const seededRandom = this.createSeededRandom(seed);
    
    // Generate colors based on prompt content with variation
    const colors = this.extractColorsFromPrompt(prompt);
    const mandalaStyle = this.determineMandalaStyle(prompt);
    
    // Add variation to the colors based on seed
    const variantColors = this.addColorVariation(colors, seededRandom);
    
    return `
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          ${this.generateGradients(variantColors, mandalaStyle, seededRandom)}
          ${this.generatePatterns(variantColors, seededRandom)}
          ${this.generateFilters()}
        </defs>
        
        <!-- Background -->
        <rect width="512" height="512" fill="url(#bgGradient)"/>
        
        <!-- Multiple mandala layers with seeded variation -->
        <g transform="translate(256,256)">
          ${this.generateOuterRing(variantColors, mandalaStyle, seededRandom)}
          ${this.generateMiddleRings(variantColors, mandalaStyle, seededRandom)}
          ${this.generateInnerPatterns(variantColors, mandalaStyle, seededRandom)}
          ${this.generateDetailedPetals(variantColors, mandalaStyle, seededRandom)}
          ${this.generateSacredGeometry(variantColors, mandalaStyle, seededRandom)}
          ${this.generateDotPatterns(variantColors, mandalaStyle, seededRandom)}
          ${this.generateCenterMotif(variantColors, mandalaStyle, seededRandom)}
        </g>
      </svg>
    `;
  }

  private determineMandalaStyle(prompt: string): 'dotpainting' | 'geometric' | 'floral' | 'sacred' {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('dot') || lowerPrompt.includes('aboriginal')) return 'dotpainting';
    if (lowerPrompt.includes('geometric') || lowerPrompt.includes('sacred')) return 'sacred';
    if (lowerPrompt.includes('flower') || lowerPrompt.includes('petal')) return 'floral';
    
    return 'geometric'; // default
  }

  private extractColorsFromPrompt(prompt: string): { 
    center: string, outer: string, dots: string, accent: string, 
    secondary: string, tertiary: string, gradient: string[] 
  } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Enhanced color palettes inspired by the provided examples
    let colors = {
      center: '#ffffff',
      outer: '#1a237e',
      dots: '#e3f2fd',
      accent: '#3949ab',
      secondary: '#26c6da',
      tertiary: '#42a5f5',
      gradient: ['#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1976d2', '#1565c0']
    };
    
    // Rainbow gradient palette
    if (lowerPrompt.includes('rainbow') || lowerPrompt.includes('colorful') || lowerPrompt.includes('vibrant')) {
      colors = {
        center: '#ffffff',
        outer: '#9c27b0',
        dots: '#e91e63',
        accent: '#ff9800',
        secondary: '#4caf50',
        tertiary: '#2196f3',
        gradient: ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800']
      };
    }
    
    // Turquoise and teal palette
    if (lowerPrompt.includes('ocean') || lowerPrompt.includes('water') || lowerPrompt.includes('teal')) {
      colors = {
        center: '#ffffff',
        outer: '#004d40',
        dots: '#b2dfdb',
        accent: '#00897b',
        secondary: '#26a69a',
        tertiary: '#4db6ac',
        gradient: ['#e0f2f1', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00796b', '#00695c']
      };
    }
    
    // Peace and calm - deeper blues
    if (lowerPrompt.includes('peace') || lowerPrompt.includes('calm') || lowerPrompt.includes('meditation')) {
      colors.outer = '#0d47a1';
      colors.accent = '#1976d2';
      colors.secondary = '#1e88e5';
      colors.gradient = ['#f3e5f5', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#9c27b0', '#8e24aa', '#7b1fa2'];
    }
    
    // Energy and vitality - warm colors
    if (lowerPrompt.includes('energy') || lowerPrompt.includes('power') || lowerPrompt.includes('strength')) {
      colors = {
        center: '#fff3e0',
        outer: '#e65100',
        dots: '#ffffff',
        accent: '#ff5722',
        secondary: '#ff7043',
        tertiary: '#ff8a65',
        gradient: ['#fff3e0', '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57400', '#ef6c00', '#e65100']
      };
    }
    
    // Healing and balance - greens and blues
    if (lowerPrompt.includes('healing') || lowerPrompt.includes('balance') || lowerPrompt.includes('nature')) {
      colors = {
        center: '#e8f5e8',
        outer: '#1b5e20',
        dots: '#c8e6c9',
        accent: '#388e3c',
        secondary: '#43a047',
        tertiary: '#66bb6a',
        gradient: ['#e8f5e8', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20']
      };
    }
    
    return colors;
  }

  private generateGradients(colors: any, style: string, seededRandom?: () => number): string {
    return `
      <!-- Main background gradient -->
      <radialGradient id="bgGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:${colors.center};stop-opacity:1" />
        <stop offset="30%" style="stop-color:${colors.gradient[2]};stop-opacity:0.9" />
        <stop offset="70%" style="stop-color:${colors.gradient[5]};stop-opacity:0.8" />
        <stop offset="100%" style="stop-color:${colors.outer};stop-opacity:1" />
      </radialGradient>

      <!-- Petal gradients -->
      <linearGradient id="petalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${colors.accent};stop-opacity:0.9" />
        <stop offset="50%" style="stop-color:${colors.secondary};stop-opacity:0.7" />
        <stop offset="100%" style="stop-color:${colors.tertiary};stop-opacity:0.8" />
      </linearGradient>

      <!-- Rainbow gradient for vibrant mandalas -->
      <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        ${colors.gradient.map((color: string, i: number) => 
          `<stop offset="${(i * 100 / (colors.gradient.length - 1))}%" style="stop-color:${color};stop-opacity:0.8" />`
        ).join('')}
      </linearGradient>

      <!-- Dot painting gradient -->
      <radialGradient id="dotGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:${colors.center};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colors.accent};stop-opacity:0.3" />
      </radialGradient>
    `;
  }

  private generatePatterns(colors: any, seededRandom?: () => number): string {
    return `
      <!-- Small dot pattern -->
      <pattern id="smallDots" patternUnits="userSpaceOnUse" width="8" height="8">
        <circle cx="4" cy="4" r="1.5" fill="${colors.dots}" opacity="0.7"/>
      </pattern>

      <!-- Medium dot pattern -->
      <pattern id="mediumDots" patternUnits="userSpaceOnUse" width="16" height="16">
        <circle cx="8" cy="8" r="3" fill="${colors.dots}" opacity="0.6"/>
        <circle cx="4" cy="4" r="1" fill="${colors.accent}" opacity="0.8"/>
        <circle cx="12" cy="12" r="1" fill="${colors.accent}" opacity="0.8"/>
      </pattern>

      <!-- Large dot pattern -->
      <pattern id="largeDots" patternUnits="userSpaceOnUse" width="24" height="24">
        <circle cx="12" cy="12" r="4" fill="${colors.dots}" opacity="0.5"/>
        <circle cx="6" cy="6" r="2" fill="${colors.secondary}" opacity="0.7"/>
        <circle cx="18" cy="18" r="2" fill="${colors.secondary}" opacity="0.7"/>
        <circle cx="18" cy="6" r="1.5" fill="${colors.tertiary}" opacity="0.9"/>
        <circle cx="6" cy="18" r="1.5" fill="${colors.tertiary}" opacity="0.9"/>
      </pattern>
    `;
  }

  private generateFilters(): string {
    return `
      <!-- Glow effect -->
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge> 
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Drop shadow -->
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    `;
  }

  private generateOuterRing(colors: any, style: string, seededRandom?: () => number): string {
    if (style === 'dotpainting') {
      return this.generateDotPaintingRing(colors, 180, 220, seededRandom);
    }

    let ring = '';
    const petalCount = 16;
    for (let i = 0; i < petalCount; i++) {
      const angle = (360 / petalCount) * i;
      ring += `
        <g transform="rotate(${angle})">
          <path d="M0,-200 Q-15,-180 -8,-160 Q0,-150 8,-160 Q15,-180 0,-200 Z" 
                fill="url(#petalGrad)" opacity="0.8" filter="url(#glow)"/>
          <path d="M0,-190 Q-8,-175 -4,-165 Q0,-160 4,-165 Q8,-175 0,-190 Z" 
                fill="${colors.dots}" opacity="0.9"/>
          <!-- Decorative dots -->
          <circle cx="0" cy="-185" r="2" fill="${colors.center}" opacity="0.9"/>
          <circle cx="0" cy="-170" r="1.5" fill="${colors.tertiary}" opacity="0.8"/>
        </g>
      `;
    }
    return ring;
  }

  private generateMiddleRings(colors: any, style: string, seededRandom?: () => number): string {
    if (style === 'dotpainting') {
      return this.generateDotPaintingRing(colors, 120, 160, seededRandom) + this.generateDotPaintingRing(colors, 80, 110, seededRandom);
    }

    let rings = '';
    // Decorative ring at radius 150
    const petals1 = 12;
    for (let i = 0; i < petals1; i++) {
      const angle = (360 / petals1) * i;
      rings += `
        <g transform="rotate(${angle})">
          <ellipse cx="0" cy="-150" rx="12" ry="25" fill="${colors.secondary}" opacity="0.7"/>
          <ellipse cx="0" cy="-145" rx="6" ry="15" fill="${colors.center}" opacity="0.9"/>
          <circle cx="0" cy="-135" r="3" fill="${colors.accent}" opacity="0.8"/>
        </g>
      `;
    }

    // Inner decorative ring at radius 100
    const petals2 = 8;
    for (let i = 0; i < petals2; i++) {
      const angle = (360 / petals2) * i;
      rings += `
        <g transform="rotate(${angle})">
          <path d="M0,-100 Q-10,-85 -5,-75 Q0,-70 5,-75 Q10,-85 0,-100 Z" 
                fill="url(#rainbowGrad)" opacity="0.6"/>
          <path d="M0,-95 Q-5,-85 0,-80 Q5,-85 0,-95 Z" 
                fill="${colors.dots}" opacity="0.8"/>
        </g>
      `;
    }

    return rings;
  }

  private generateInnerPatterns(colors: any, style: string, seededRandom?: () => number): string {
    if (style === 'dotpainting') {
      return this.generateDotPaintingRing(colors, 40, 70, seededRandom);
    }

    return `
      <!-- Concentric circles with intricate patterns -->
      <circle r="70" fill="none" stroke="${colors.accent}" stroke-width="2" opacity="0.8" stroke-dasharray="10,5"/>
      <circle r="65" fill="none" stroke="${colors.secondary}" stroke-width="1" opacity="0.6"/>
      <circle r="55" fill="none" stroke="${colors.tertiary}" stroke-width="2" opacity="0.7" stroke-dasharray="3,3"/>
      <circle r="50" fill="none" stroke="${colors.dots}" stroke-width="1" opacity="0.8"/>
      
      <!-- Geometric pattern -->
      ${this.generateStarPattern(colors, 60, 8)}
      ${this.generateStarPattern(colors, 45, 6)}
    `;
  }

  private generateDetailedPetals(colors: any, style: string, seededRandom?: () => number): string {
    if (style === 'floral') {
      return this.generateFloralPetals(colors, seededRandom);
    }
    
    let petals = '';
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i;
      petals += `
        <g transform="rotate(${angle})">
          <!-- Main petal -->
          <path d="M0,-35 Q-12,-25 -8,-15 Q-4,-8 0,-10 Q4,-8 8,-15 Q12,-25 0,-35 Z" 
                fill="url(#petalGrad)" opacity="0.8" filter="url(#shadow)"/>
          <!-- Inner petal detail -->
          <path d="M0,-30 Q-6,-22 -3,-18 Q0,-15 3,-18 Q6,-22 0,-30 Z" 
                fill="${colors.center}" opacity="0.9"/>
          <!-- Petal lines -->
          <line x1="0" y1="-30" x2="0" y2="-15" stroke="${colors.accent}" stroke-width="0.5" opacity="0.7"/>
          <line x1="-2" y1="-25" x2="2" y2="-20" stroke="${colors.secondary}" stroke-width="0.3" opacity="0.6"/>
        </g>
      `;
    }
    return petals;
  }

  private generateSacredGeometry(colors: any, style: string, seededRandom?: () => number): string {
    if (style === 'sacred') {
      return this.generateFlowerOfLife(colors, seededRandom) + this.generateSeedOfLife(colors, seededRandom);
    }

    return `
      <!-- Simplified sacred geometry -->
      <g opacity="0.5">
        <circle r="25" fill="none" stroke="${colors.dots}" stroke-width="1"/>
        <circle cx="21.7" cy="12.5" r="25" fill="none" stroke="${colors.dots}" stroke-width="1"/>
        <circle cx="-21.7" cy="12.5" r="25" fill="none" stroke="${colors.dots}" stroke-width="1"/>
        <circle cx="21.7" cy="-12.5" r="25" fill="none" stroke="${colors.dots}" stroke-width="1"/>
        <circle cx="-21.7" cy="-12.5" r="25" fill="none" stroke="${colors.dots}" stroke-width="1"/>
        <circle cx="0" cy="25" r="25" fill="none" stroke="${colors.dots}" stroke-width="1"/>
        <circle cx="0" cy="-25" r="25" fill="none" stroke="${colors.dots}" stroke-width="1"/>
      </g>
    `;
  }

  private generateDotPatterns(colors: any, style: string, seededRandom?: () => number): string {
    if (style !== 'dotpainting') return '';

    let dots = '';
    // Create intricate dot patterns like in the reference image
    const rings = [30, 50, 70, 90, 110, 130, 150, 170];
    
    rings.forEach((radius, ringIndex) => {
      const dotCount = Math.floor(radius / 3);
      for (let i = 0; i < dotCount; i++) {
        const angle = (360 / dotCount) * i;
        const x = Math.cos(angle * Math.PI / 180) * radius;
        const y = Math.sin(angle * Math.PI / 180) * radius;
        
        const dotSize = 1.5 + Math.sin(ringIndex * 0.5) * 1;
        const opacity = 0.7 + Math.sin(i * 0.3) * 0.3;
        
        dots += `<circle cx="${x}" cy="${y}" r="${dotSize}" fill="${colors.dots}" opacity="${opacity}"/>`;
        
        // Add smaller accent dots
        if (i % 3 === 0) {
          const accentX = Math.cos((angle + 15) * Math.PI / 180) * (radius - 5);
          const accentY = Math.sin((angle + 15) * Math.PI / 180) * (radius - 5);
          dots += `<circle cx="${accentX}" cy="${accentY}" r="0.8" fill="${colors.secondary}" opacity="0.9"/>`;
        }
      }
    });

    return dots;
  }

  private generateCenterMotif(colors: any, style: string, seededRandom?: () => number): string {
    if (style === 'dotpainting') {
      return `
        <!-- Center dot pattern -->
        <circle r="15" fill="${colors.outer}" opacity="0.8"/>
        <circle r="12" fill="${colors.dots}" opacity="0.9"/>
        <circle r="8" fill="${colors.accent}" opacity="0.8"/>
        <circle r="5" fill="${colors.center}" opacity="1"/>
        <circle r="2" fill="${colors.outer}" opacity="0.9"/>
      `;
    }

    return `
      <!-- Ornate center -->
      <circle r="20" fill="url(#dotGrad)" opacity="0.8"/>
      <circle r="15" fill="none" stroke="${colors.accent}" stroke-width="2" opacity="0.9"/>
      <circle r="10" fill="${colors.center}" opacity="0.9"/>
      <circle r="6" fill="none" stroke="${colors.secondary}" stroke-width="1" opacity="0.8"/>
      <circle r="3" fill="${colors.accent}" opacity="1"/>
    `;
  }

  // Additional helper methods for sophisticated mandala generation
  private generateDotPaintingRing(colors: any, innerRadius: number, outerRadius: number, seededRandom?: () => number): string {
    let dots = '';
    const ringWidth = outerRadius - innerRadius;
    const dotDensity = Math.floor(innerRadius / 5); // Varies dot density based on radius
    
    for (let radius = innerRadius; radius <= outerRadius; radius += 4) {
      const circumference = 2 * Math.PI * radius;
      const dotCount = Math.floor(circumference / 8);
      
      for (let i = 0; i < dotCount; i++) {
        const angle = (360 / dotCount) * i;
        const x = Math.cos(angle * Math.PI / 180) * radius;
        const y = Math.sin(angle * Math.PI / 180) * radius;
        
        // Vary dot sizes and colors for authentic dot painting look
        const random = seededRandom || Math.random;
        const dotSize = 1 + random() * 2;
        const opacity = 0.6 + random() * 0.4;
        const colorVariant = random() > 0.7 ? colors.secondary : colors.dots;
        
        dots += `<circle cx="${x}" cy="${y}" r="${dotSize}" fill="${colorVariant}" opacity="${opacity}"/>`;
        
        // Add tiny highlight dots
        if (random() > 0.8) {
          dots += `<circle cx="${x}" cy="${y}" r="0.5" fill="${colors.center}" opacity="0.9"/>`;
        }
      }
    }
    
    return dots;
  }

  private generateStarPattern(colors: any, radius: number, points: number): string {
    let pattern = '';
    const outerRadius = radius;
    const innerRadius = radius * 0.6;
    
    let pathData = 'M';
    for (let i = 0; i <= points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      
      if (i === 0) {
        pathData += `${x},${y}`;
      } else {
        pathData += ` L${x},${y}`;
      }
    }
    pathData += ' Z';
    
    pattern = `
      <path d="${pathData}" fill="none" stroke="${colors.accent}" stroke-width="1.5" opacity="0.7"/>
      <path d="${pathData}" fill="${colors.dots}" opacity="0.2"/>
    `;
    
    return pattern;
  }

  private generateFloralPetals(colors: any, seededRandom?: () => number): string {
    let petals = '';
    const petalSets = [
      { count: 8, radius: 35, size: { rx: 8, ry: 20 } },
      { count: 16, radius: 25, size: { rx: 4, ry: 12 } },
      { count: 24, radius: 15, size: { rx: 2, ry: 8 } }
    ];
    
    petalSets.forEach((set, setIndex) => {
      for (let i = 0; i < set.count; i++) {
        const angle = (360 / set.count) * i;
        const colorIndex = setIndex % colors.gradient.length;
        const petalColor = colors.gradient[colorIndex] || colors.accent;
        
        petals += `
          <g transform="rotate(${angle})">
            <ellipse cx="0" cy="-${set.radius}" rx="${set.size.rx}" ry="${set.size.ry}" 
                     fill="${petalColor}" opacity="0.8"/>
            <ellipse cx="0" cy="-${set.radius}" rx="${set.size.rx * 0.6}" ry="${set.size.ry * 0.8}" 
                     fill="${colors.center}" opacity="0.6"/>
            <!-- Petal vein -->
            <line x1="0" y1="-${set.radius - set.size.ry * 0.8}" x2="0" y2="-${set.radius + set.size.ry * 0.8}" 
                  stroke="${colors.secondary}" stroke-width="0.5" opacity="0.7"/>
          </g>
        `;
      }
    });
    
    return petals;
  }

  private generateFlowerOfLife(colors: any, seededRandom?: () => number): string {
    const radius = 20;
    const centers = [
      { x: 0, y: 0 },
      { x: radius * Math.cos(0), y: radius * Math.sin(0) },
      { x: radius * Math.cos(Math.PI / 3), y: radius * Math.sin(Math.PI / 3) },
      { x: radius * Math.cos(2 * Math.PI / 3), y: radius * Math.sin(2 * Math.PI / 3) },
      { x: radius * Math.cos(Math.PI), y: radius * Math.sin(Math.PI) },
      { x: radius * Math.cos(4 * Math.PI / 3), y: radius * Math.sin(4 * Math.PI / 3) },
      { x: radius * Math.cos(5 * Math.PI / 3), y: radius * Math.sin(5 * Math.PI / 3) }
    ];
    
    let pattern = '<g opacity="0.6">';
    centers.forEach(center => {
      pattern += `<circle cx="${center.x}" cy="${center.y}" r="${radius}" fill="none" stroke="${colors.dots}" stroke-width="1"/>`;
    });
    pattern += '</g>';
    
    return pattern;
  }

  private generateSeedOfLife(colors: any, seededRandom?: () => number): string {
    const radius = 12;
    let pattern = '<g opacity="0.4">';
    
    // Central circle
    pattern += `<circle cx="0" cy="0" r="${radius}" fill="none" stroke="${colors.accent}" stroke-width="1"/>`;
    
    // Six surrounding circles
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      pattern += `<circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${colors.accent}" stroke-width="1"/>`;
    }
    
    pattern += '</g>';
    return pattern;
  }

  // Seeded random generation for consistent but varied output
  private createSeedFromInput(prompt: string, brainwaveData?: { attention: number, meditation: number, signalQuality: number }): number {
    let seedString = prompt.toLowerCase().trim();
    
    if (brainwaveData) {
      seedString += `|${brainwaveData.attention}|${brainwaveData.meditation}|${brainwaveData.signalQuality}`;
    }
    
    // Simple hash function to convert string to number
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash);
  }

  private createSeededRandom(seed: number): () => number {
    // Linear Congruential Generator for reproducible randomness
    let currentSeed = seed % 2147483647;
    if (currentSeed <= 0) currentSeed += 2147483646;

    return function() {
      currentSeed = currentSeed * 16807 % 2147483647;
      return (currentSeed - 1) / 2147483646;
    };
  }

  private addColorVariation(colors: any, random: () => number): any {
    // Create subtle variations to base colors while maintaining harmony
    const hueShift = (random() - 0.5) * 60; // ±30 degree hue shift
    const saturationShift = (random() - 0.5) * 0.3; // ±15% saturation shift
    const lightnessShift = (random() - 0.5) * 0.2; // ±10% lightness shift
    
    const variantColors = { ...colors };
    
    // Apply subtle variations to gradient colors
    if (colors.gradient && Array.isArray(colors.gradient)) {
      variantColors.gradient = colors.gradient.map((color: string) => 
        this.adjustColorHSL(color, hueShift, saturationShift, lightnessShift)
      );
    }
    
    // Vary accent colors slightly
    variantColors.accent = this.adjustColorHSL(colors.accent, hueShift * 0.5, saturationShift * 0.5, lightnessShift * 0.3);
    variantColors.secondary = this.adjustColorHSL(colors.secondary, hueShift * 0.3, saturationShift * 0.3, lightnessShift * 0.2);
    variantColors.tertiary = this.adjustColorHSL(colors.tertiary, hueShift * 0.4, saturationShift * 0.4, lightnessShift * 0.25);
    
    return variantColors;
  }

  private adjustColorHSL(hexColor: string, hueShift: number, satShift: number, lightShift: number): string {
    // Simple color adjustment - this is a basic implementation
    // In a production system, you'd want a more robust HSL conversion
    
    // For now, return a slightly modified version of the original color
    // by adjusting the hex values slightly
    const hex = hexColor.replace('#', '');
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    
    // Apply simple RGB adjustments as approximation
    r = Math.min(255, Math.max(0, Math.round(r + (hueShift * 2))));
    g = Math.min(255, Math.max(0, Math.round(g + (satShift * 50))));
    b = Math.min(255, Math.max(0, Math.round(b + (lightShift * 30))));
    
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private getFallbackPrompt(options: MandalaGenerationOptions): string {
    const { brainwaveData, voiceTranscript, style = 'spiritual', colorPalette = 'vibrant' } = options;
    
    // Determine visual style based on content
    const mandalaStyle = this.determineMandalaStyle(voiceTranscript + ' ' + style);
    const colorTheme = this.getColorTheme(voiceTranscript, colorPalette);
    
    let prompt = `Create an intricate, highly detailed ${mandalaStyle} mandala with ${colorTheme}. `;
    
    // Style-specific enhancements
    if (mandalaStyle === 'dotpainting') {
      prompt += "Traditional Aboriginal dot painting style with varying dot sizes, deep contrasts, and authentic indigenous patterns. ";
    } else if (mandalaStyle === 'geometric') {
      prompt += "Precise geometric patterns, sacred mathematical ratios, and complex symmetrical designs with fine line work. ";
    } else if (mandalaStyle === 'floral') {
      prompt += "Ornate botanical elements, layered flower petals, organic curves, and nature-inspired motifs. ";
    } else if (mandalaStyle === 'sacred') {
      prompt += "Sacred geometry including Flower of Life, Seed of Life, and other spiritual symbols with mystical significance. ";
    }
    
    // Brainwave-inspired patterns
    if (brainwaveData.attention > 70) {
      prompt += "Sharp, focused patterns with high contrast, precise details, angular elements, and concentrated energy radiating from center. ";
    } else if (brainwaveData.attention < 30) {
      prompt += "Soft, flowing patterns with gentle transitions, organic curves, and dispersed energy throughout the design. ";
    }
    
    if (brainwaveData.meditation > 70) {
      prompt += "Deep meditative qualities with concentric circles, spiral patterns, peaceful symmetry, and serene balance. ";
    } else if (brainwaveData.meditation < 30) {
      prompt += "Dynamic energy patterns with radiating lines, active movement, and vibrant expressions of consciousness. ";
    }
    
    // Voice transcript themes
    if (voiceTranscript.length > 10) {
      const themes = this.extractThemes(voiceTranscript);
      const emotions = this.extractEmotionalContext(voiceTranscript);
      
      if (themes.length > 0) {
        prompt += `Incorporate symbolic representations of ${themes.join(', ')} through meaningful visual metaphors and traditional iconography. `;
      }
      
      if (emotions.length > 0) {
        prompt += `Express emotional themes of ${emotions.join(', ')} through color harmony, pattern flow, and spiritual symbolism. `;
      }
    }
    
    // Final enhancement based on examples
    prompt += "Multiple intricate layers from outer decorative border to detailed center motif, with professional artistic quality, " +
              "perfect radial symmetry, rich detail density, harmonious color relationships, and spiritual depth that invites contemplation and meditation.";
    
    return prompt;
  }

  private getColorTheme(transcript: string, colorPalette: string): string {
    const lowerTranscript = transcript.toLowerCase();
    
    // Analyze transcript for color preferences
    if (lowerTranscript.includes('rainbow') || lowerTranscript.includes('colorful') || lowerTranscript.includes('bright')) {
      return "vibrant rainbow gradients with rich, saturated colors transitioning smoothly from deep purples and magentas through blues, teals, greens, yellows, and warm oranges";
    }
    
    if (lowerTranscript.includes('ocean') || lowerTranscript.includes('water') || lowerTranscript.includes('sea')) {
      return "oceanic blues and teals with flowing turquoise, aquamarine, and deep sea blue gradients";
    }
    
    if (lowerTranscript.includes('sunset') || lowerTranscript.includes('warm') || lowerTranscript.includes('fire')) {
      return "warm sunset palette with golden yellows, deep oranges, coral reds, and rich amber tones";
    }
    
    if (lowerTranscript.includes('forest') || lowerTranscript.includes('nature') || lowerTranscript.includes('green')) {
      return "natural forest greens with emerald, sage, jade, and earth tone accents";
    }
    
    if (lowerTranscript.includes('peace') || lowerTranscript.includes('calm') || lowerTranscript.includes('meditation')) {
      return "serene blue and purple gradients with soft lavender, deep indigo, and peaceful sky blues";
    }
    
    if (lowerTranscript.includes('energy') || lowerTranscript.includes('power') || lowerTranscript.includes('strength')) {
      return "energetic warm colors with brilliant oranges, fiery reds, golden yellows, and dynamic contrasts";
    }
    
    // Default based on colorPalette parameter
    if (colorPalette === 'vibrant') {
      return "rich, vibrant colors with strong contrasts and luminous qualities";
    } else if (colorPalette === 'earth') {
      return "warm earth tones with browns, ochres, and natural mineral colors";
    } else if (colorPalette === 'cool') {
      return "cool blues, purples, and teals with soothing gradients";
    }
    
    return "harmonious color palette with balanced warm and cool tones";
  }

  private extractEmotionalContext(transcript: string): string[] {
    const lowerTranscript = transcript.toLowerCase();
    const emotions: string[] = [];
    
    const emotionMap = {
      'joy': ['joy', 'happy', 'celebration', 'euphoria', 'bliss', 'delight', 'elated'],
      'peace': ['peace', 'calm', 'tranquil', 'serene', 'stillness', 'quiet', 'harmony'],
      'love': ['love', 'compassion', 'warmth', 'tenderness', 'affection', 'caring'],
      'gratitude': ['grateful', 'thankful', 'appreciation', 'blessed', 'grace'],
      'wonder': ['wonder', 'awe', 'amazement', 'mystery', 'magic', 'marvel'],
      'strength': ['strength', 'power', 'courage', 'resilience', 'determination'],
      'healing': ['healing', 'restoration', 'renewal', 'recovery', 'wellness'],
      'wisdom': ['wisdom', 'insight', 'understanding', 'knowledge', 'enlightenment'],
      'connection': ['connection', 'unity', 'oneness', 'belonging', 'togetherness'],
      'transformation': ['change', 'growth', 'evolution', 'metamorphosis', 'journey']
    };
    
    for (const [emotion, keywords] of Object.entries(emotionMap)) {
      if (keywords.some(keyword => lowerTranscript.includes(keyword))) {
        emotions.push(emotion);
      }
    }
    
    return emotions.length > 0 ? emotions : ['balance', 'harmony'];
  }

  private extractThemes(transcript: string): string[] {
    const lowerTranscript = transcript.toLowerCase();
    const themes: string[] = [];
    
    const themeMap = {
      'nature': ['nature', 'tree', 'flower', 'water', 'earth', 'sky', 'mountain', 'forest'],
      'peace': ['peace', 'calm', 'tranquil', 'serene', 'quiet', 'still'],
      'love': ['love', 'heart', 'compassion', 'kindness', 'care'],
      'wisdom': ['wisdom', 'knowledge', 'understanding', 'insight', 'truth'],
      'energy': ['energy', 'power', 'strength', 'force', 'vibration'],
      'healing': ['healing', 'health', 'wellness', 'recovery', 'balance'],
      'spirituality': ['spiritual', 'divine', 'sacred', 'holy', 'meditation', 'prayer']
    };
    
    for (const [theme, keywords] of Object.entries(themeMap)) {
      if (keywords.some(keyword => lowerTranscript.includes(keyword))) {
        themes.push(theme);
      }
    }
    
    return themes.length > 0 ? themes : ['harmony', 'balance'];
  }

  async analyzeSentiment(text: string): Promise<{
    rating: number;
    confidence: number;
    emotions: string[];
  }> {
    try {
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a sentiment analysis expert. Analyze the emotional content of text and provide a rating, confidence score, and dominant emotions. Respond with JSON in this format: { 'rating': number (1-5), 'confidence': number (0-1), 'emotions': string[] }"
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        rating: Math.max(1, Math.min(5, Math.round(result.rating || 3))),
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        emotions: Array.isArray(result.emotions) ? result.emotions : ['neutral']
      };
      
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return {
        rating: 3,
        confidence: 0.5,
        emotions: ['neutral']
      };
    }
  }
}

export const openaiService = new OpenAIService();
