# Stage 1: Build Frontend
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend & Transcoder Runtime
FROM node:22-bookworm-slim
WORKDIR /app

# Install FFmpeg and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

RUN mkdir -p /app/temp

EXPOSE 7700

ENV PORT=7700
ENV TEMP_DIR=/app/temp

CMD ["npx", "tsx", "src/server.ts"]
