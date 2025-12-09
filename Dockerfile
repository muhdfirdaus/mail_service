# ===== Stage 1: Builder =====
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and tsconfig
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript -> JavaScript
RUN npm run build

# ===== Stage 2: Runtime =====
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production

# Optional, choose the port your app listens on
EXPOSE 8080

# Use whatever you have in package.json "start"
CMD ["npm", "run", "start"]
