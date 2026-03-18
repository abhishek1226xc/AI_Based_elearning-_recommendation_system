FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build client assets for production static serving
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV LOCAL_AI_FALLBACK=true

EXPOSE 3000

CMD ["npm", "run", "start"]
