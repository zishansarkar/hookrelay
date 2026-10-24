FROM node:20-alpine AS builder

WORKDIR /workspace
RUN apk add --no-cache curl

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace=@hookrelay/shared \
    && npm run build --workspace=@hookrelay/api

FROM node:20-alpine AS runner

ENV NODE_ENV=production \
    PORT=3001
WORKDIR /workspace
RUN apk add --no-cache curl

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace=@hookrelay/api --workspace=@hookrelay/shared --include-workspace-root=false \
    && npm cache clean --force

COPY --from=builder /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder /workspace/packages/shared/dist ./packages/shared/dist

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD-SHELL curl -fsS "http://localhost:${PORT:-3001}/health" || exit 1

CMD ["node", "apps/api/dist/server.js"]
