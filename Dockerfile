# Production Dockerfile for Google Cloud Run Deployment
# AuraFamily AI - Family Personal Assistant & Life OS

FROM node:22-bookworm-slim

# Install ffmpeg for camera streaming and system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies including optional platform binaries
RUN npm install --include=optional

# Explicitly ensure Linux rolldown native binding is installed for Vite on Linux amd64
RUN npm install --no-save @rolldown/binding-linux-x64-gnu || true

# Copy application code
COPY . .

# Build client production bundle (Vite React 19 to dist/)
RUN npm run build

# Cloud Run defaults
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Launch server.ts via npm start
CMD ["npm", "start"]
