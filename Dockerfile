FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci  && npm cache clean --force

COPY . .

FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs \
  && adduser -S -G nodejs express

WORKDIR /app

COPY --chown=express:nodejs package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=express:nodejs /app .

USER express

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]