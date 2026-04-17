FROM node:20-alpine

WORKDIR /app

# Copy only dependency files first (better caching)
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Now copy rest of the app (without node_modules because of .dockerignore)
COPY . .

# Build app (optional for dev, but good for caching/testing)
# RUN pnpm build 

EXPOSE 3000

CMD ["pnpm", "dev"]
