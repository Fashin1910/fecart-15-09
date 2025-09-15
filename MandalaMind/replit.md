# Overview

This is a biometric mandala generation application that creates personalized spiritual artwork based on real-time brainwave data and voice input. The system captures EEG signals from NeuroSky devices, processes voice transcripts, and uses AI to generate unique mandalas that reflect the user's mental and emotional state. Built as a full-stack TypeScript application with real-time capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Modern React application using functional components and hooks
- **Vite Build System**: Fast development server and optimized production builds
- **Shadcn/ui Components**: Comprehensive UI component library built on Radix UI primitives
- **TailwindCSS**: Utility-first CSS framework with dark theme support
- **React Query**: Server state management and caching for API interactions
- **Wouter**: Lightweight client-side routing

## Backend Architecture
- **Express.js**: RESTful API server with TypeScript
- **WebSocket Integration**: Real-time bidirectional communication for EEG data streaming
- **Modular Service Architecture**: Separate services for NeuroSky integration and OpenAI processing
- **In-Memory Storage**: Simple storage implementation with interface for future database integration
- **Shared Schema**: Common TypeScript types and Zod validation schemas

## Data Management
- **Drizzle ORM**: Type-safe database toolkit configured for PostgreSQL
- **Session-Based Architecture**: User sessions track brainwave data and generated mandalas
- **Real-Time Data Flow**: Continuous EEG data capture with WebSocket streaming to frontend
- **Structured Data Models**: Sessions, mandalas, and EEG data with proper relationships

## Core Features
- **Brainwave Visualization**: Real-time EEG waveform rendering with HTML5 Canvas
- **Voice Recognition**: Browser-based speech-to-text for meditation prompts
- **AI-Powered Generation**: OpenAI integration for intelligent mandala prompt creation
- **Device Management**: NeuroSky headset connection and status monitoring
- **Mandala Gallery**: Image display with download and sharing capabilities

## Security & Performance
- **Type Safety**: End-to-end TypeScript with strict configuration
- **Error Handling**: Comprehensive error boundaries and API error management
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Development Tooling**: Hot reload, runtime error overlays, and Replit integration

# External Dependencies

## Hardware Integration
- **NeuroSky ThinkGear**: EEG headset connectivity via serial/USB interface
- **ThinkGear Connector**: Local WebSocket server for device communication

## AI Services
- **OpenAI API**: GPT-5 model for intelligent prompt generation and DALL-E for image creation
- **Speech Recognition API**: Browser-native Web Speech API for voice input

## Database & Storage
- **PostgreSQL**: Configured via Drizzle ORM for production data persistence
- **Neon Database**: Serverless PostgreSQL provider integration

## Development & Deployment
- **Replit Platform**: Integrated development environment with deployment capabilities
- **ESBuild**: Fast bundling for server-side code compilation
- **PostCSS**: CSS processing with autoprefixer for browser compatibility