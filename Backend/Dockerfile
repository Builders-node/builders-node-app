# Builders Node API (NestJS + Prisma)
FROM node:20-alpine

# Prisma needs openssl at runtime.
RUN apk add --no-cache openssl
WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci

# Generate the Prisma client + build the app.
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

# Apply migrations against the (possibly empty) database, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
