FROM node:22-bookworm-slim AS build
WORKDIR /workspace/server
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /workspace/server
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /workspace/server/dist ./dist
RUN mkdir -p /workspace/server/data/media && chown -R node:node /workspace/server/data
USER node
EXPOSE 3000
CMD ["node","dist/main.js"]
