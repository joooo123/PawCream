ARG NODE_BASE_IMAGE=node:22-alpine
FROM ${NODE_BASE_IMAGE}

WORKDIR /app

COPY package.json ./
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm install --omit=dev --no-audit --no-fund --registry="$NPM_REGISTRY"

COPY src ./src

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["npm", "start"]
