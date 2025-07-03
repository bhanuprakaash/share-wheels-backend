FROM node:20-alpine

ARG NODE_ENV=development

RUN apk add --no-cache dumb-init

WORKDIR /app

RUN addgroup -g 1001 -S nodejs \
  && adduser -S -G nodejs express

COPY --chown=express:nodejs package*.json ./

RUN npm install && npm cache clean --force

ENV NODE_ENV=$NODE_ENV

COPY --chown=express:nodejs . .

USER express

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]