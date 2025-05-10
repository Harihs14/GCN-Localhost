# Global Compliance Navigator (GCN) Legacy

A comprehensive compliance management and knowledge system that helps organizations navigate and understand regulatory requirements, standards, and best practices.

## Overview

GCN Legacy is an AI-powered platform designed to assist compliance professionals, quality managers, and regulatory affairs specialists in managing and understanding complex compliance requirements. The system combines document management, AI-powered search, and real-time compliance guidance.

## Key Features

- **Intelligent Document Management**

  - Upload and manage compliance-related PDF documents
  - Automatic text extraction and vectorization for semantic search
  - Document categorization and metadata management

- **AI-Powered Compliance Assistant**

  - Natural language querying of compliance requirements
  - Context-aware responses based on uploaded documents and online sources
  - Support for various compliance standards (ISO, IEC, IEEE, etc.)

- **Multi-Modal Information Retrieval**

  - Text-based search across uploaded documents
  - Web search integration for up-to-date information
  - Image and video search for visual compliance guidance

- **Interactive Features**
  - Real-time chat interface for compliance queries
  - Related query suggestions
  - Document preview and management
  - Product-specific compliance guidance

## Technical Architecture

The project consists of three main components:

- **Frontend** (`/frontend`): React-based web application

  - Modern UI with responsive design
  - Real-time chat interface
  - Document management system
  - Product management features

- **Backend** (`/backend`): Node.js server

  - User authentication and authorization
  - Document storage and retrieval
  - API endpoints for frontend communication

- **AI Backend** (`/new_ai_backend`): Python FastAPI service
  - AI-powered text processing and analysis
  - Integration with Ollama for LLM capabilities
  - Web scraping and information retrieval
  - Vector-based semantic search

## Environment Setup

1. Copy the example environment file:

   ```
   cp .env.example .env
   ```

2. Configure the following in your `.env` file:

   - Email configuration for notifications
   - Ngrok authentication for tunneling
   - Database credentials (PostgreSQL)
   - API keys (SerpAPI for web search)
   - AI Backend URL

3. Database Setup:
   - PostgreSQL database required
   - Default database name: `gcn-legacy`
   - Tables will be created automatically on first run

## Development Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm start
```

### AI Backend

```bash
cd new_ai_backend
pip install -r requirements.txt
python main.py
```

## Security Notes

- Never commit the `.env` file to version control
- All sensitive credentials should be stored in environment variables
- The `.gitignore` file is configured to exclude sensitive files
- Use secure passwords and API keys in production

## Dependencies

- Node.js and npm for frontend and backend
- Python 3.8+ for AI backend
- PostgreSQL database
- Ollama for local LLM capabilities
- SerpAPI for web search functionality

## License

[Add appropriate license information]
