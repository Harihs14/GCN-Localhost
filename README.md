# GCN Legacy Project

This repository contains the code for the GCN Legacy application.

## Environment Setup

This project uses environment variables for sensitive information and configuration. Here's how to set them up:

1. Copy the example environment file:

   ```
   cp .env.example .env
   ```

2. Edit the `.env` file and fill in your actual values for:
   - Email configuration
   - Ngrok authentication
   - Database credentials
   - API keys (SerpAPI, etc.)

## Important Security Notes

- Never commit the `.env` file to version control
- All sensitive credentials should be stored in environment variables, not hardcoded
- The `.gitignore` file is configured to exclude `.env` and other sensitive files

## Project Structure

- `/frontend`: Front-end React application
- `/backend`: Node.js server API
- `/new_ai_backend`: Python AI backend service

## Local Development

To run the project locally, use the provided scripts in each project directory.
