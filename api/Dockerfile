# Image of the API, in two stages. `build` compiles the code; compose also
# runs it as the `migrate` service, since it keeps the Prisma CLI and tsx.
# The final stage only keeps what `node dist/main.js` needs.

FROM node:26-alpine AS build
WORKDIR /app
# Dependencies before the code, so this layer stays cached while they do not
# change. The schema comes with them: the postinstall runs `prisma generate`.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/
RUN npm ci
COPY . .
RUN npm run build
# SQLite writes the database and its journal side by side: the whole folder
# must belong to `node`, the user the processes run as, not to root.
RUN mkdir -p /app/db && chown node:node /app/db
USER node

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# Production dependencies only. Install scripts are skipped, as the Prisma
# client is already compiled into dist/; better-sqlite3 still needs its native
# binding. The cache is cleaned in the same layer, or the image would not shrink.
RUN npm ci --omit=dev --omit=optional --ignore-scripts \
 && npm rebuild better-sqlite3 && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/db && chown node:node /app/db
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
