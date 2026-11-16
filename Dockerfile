FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod 0555 /app/docker-entrypoint.sh \
  && chown -R node:node /app
USER node
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
