# EmotionFlix

An emotion-driven movie recommendation platform that uses facial recognition and machine learning to suggest films based on your current mood.

**Class Project** | Spring 2025 Senior Project | Ramapo College of New Jersey

---

## Overview

EmotionFlix reimagines movie discovery by analyzing users' emotional states to deliver personalized recommendations. Unlike traditional recommendation systems that rely solely on viewing history and ratings, this application uses real-time emotion detection combined with adaptive learning algorithms to match movies to users' current feelings.

## Key Features

### Multi-Modal Emotion Detection
- **Real-time facial analysis** using face-api.js neural networks with webcam integration
- **Photo upload** processing for emotion extraction from user-provided images
- **Manual input** option with intuitive emotion sliders for accessibility
- **Privacy-first**: All emotion processing happens client-side; no images stored or transmitted

### Intelligent Recommendation Engine
- **Hybrid algorithm** combining emotion-to-genre mapping with personalized user preferences
- **Adaptive learning** that evolves with user interactions and feedback
- **Multi-factor scoring** considering emotion compatibility, movie ratings, and popularity
- **TMDB integration** for comprehensive, up-to-date movie metadata

### Personalized User Experience
- **Watchlist management** for saving and organizing movies
- **Watch history** tracking with emotional context and timestamps
- **Custom emotion profiles** that adapt to individual user patterns
- **Responsive design** optimized for desktop, tablet, and mobile devices

## Technical Architecture

### Tech Stack

**Frontend**
- React 19 with TypeScript for type-safe component development
- Vite for optimized build performance and development experience
- Tailwind CSS v3.4 for utility-first styling and rapid UI development
- face-api.js v0.22 for client-side neural network emotion detection
- React Router Dom v7 for single-page application navigation

**Backend**
- Node.js with Express v5 REST API server
- PostgreSQL relational database with optimized indexing
- JWT authentication with bcryptjs password hashing
- TMDB API v3 integration for movie data

**Testing & Quality Assurance**
- 69 comprehensive tests (59 backend, 10 frontend) with 100% pass rate
- Vitest + React Testing Library for frontend component testing
- Jest + Supertest for backend API and security testing
- Comprehensive security test suite validating SQL injection protection, authentication, and authorization

### System Design

The application implements a **three-tier architecture** with clear separation of concerns:

1. **Presentation Layer**: React frontend with reusable component library and context-based state management
2. **Business Logic Layer**: Express API handling authentication, recommendation algorithms, and external service integration
3. **Data Layer**: PostgreSQL database with normalized schema supporting emotion tracking, user preferences, and movie metadata caching

**Key Architectural Decisions:**
- Client-side emotion detection ensures user privacy while maintaining real-time performance
- Personalized emotion mapping system uses exponential moving averages to learn from user behavior
- Movie metadata caching reduces API calls and improves response times
- Comprehensive testing strategy prioritizes security, edge cases, and real-world scenarios

## Database Schema

The database implements a **normalized relational model** supporting:
- User authentication and profile management
- Emotion session tracking with confidence scoring
- Personalized emotion-to-genre mappings with adaptive learning
- Movie metadata caching with JSONB flexibility
- Interaction tracking for watchlist, watch history, and recommendations

**Performance optimizations** include strategic indexing on user-based queries, movie quality filters, and composite indexes on frequently joined columns.

## Development Highlights

### Machine Learning Integration
- Implemented three pre-trained neural networks: SSD MobileNet v1 for face detection, 68-point facial landmark detection, and facial expression recognition
- Enhanced emotion detection accuracy through custom post-processing algorithms and confidence scoring
- Developed fallback mechanisms for low-confidence detections

### Recommendation Algorithm
- Created hybrid recommendation engine combining multiple data sources
- Implemented weighted scoring system balancing emotion compatibility (40%), movie ratings (35%), and popularity (25%)
- Developed adaptive learning system that personalizes recommendations based on user interaction patterns

### Security Implementation
- Comprehensive security test suite validating protection against SQL injection, XSS, and authentication bypass attacks
- JWT-based authentication with secure token management
- Input validation using Zod schemas for TypeScript runtime type checking

## Running the Project

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- TMDB API key

### Quick Start

```bash
# Install dependencies
npm install
cd server && npm install

# Configure environment
# Copy .env.example to .env and add TMDB API key

# Start development servers
npm run dev                    # Frontend (port 5173)
cd server && npm run dev       # Backend (port 3000)
```

### Testing

```bash
npm test                       # Run all tests
npm run test:coverage          # Generate coverage reports
npm run test:security          # Run security test suite
```

## Project Outcomes

This project demonstrates practical application of:
- Full-stack web development with modern JavaScript frameworks
- Machine learning integration for real-world use cases
- Database design and optimization for scalable applications
- RESTful API design and implementation
- Comprehensive testing methodologies including security validation
- User-centered design principles and responsive UI/UX

The combination of emotion detection technology, adaptive recommendation algorithms, and privacy-first architecture showcases technical competency across frontend development, backend engineering, database management, and machine learning integration.

## License

Educational project for academic purposes.
