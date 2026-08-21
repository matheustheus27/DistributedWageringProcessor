FROM oven/bun:1.1-alpine AS base
WORKDIR /usr/src/app

COPY package.json bun.lockb* tsconfig.json ./
RUN bun install --frozen-lockfile || bun install

COPY . .

EXPOSE 3000
CMD ["bun", "run", "src/main.ts"]
