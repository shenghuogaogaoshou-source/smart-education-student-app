FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PYTHONUTF8=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/data \
    HOST=0.0.0.0 \
    PORT=8080 \
    BRAIN_INTERNAL_ORIGIN=http://127.0.0.1:8766

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 ffmpeg fonts-noto-cjk ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/brain-film/package.json ./apps/brain-film/package.json
COPY apps/creative-module/package.json ./apps/creative-module/package.json
COPY packages/works-bridge/package.json ./packages/works-bridge/package.json
RUN npm ci --omit=dev --ignore-scripts

COPY server ./server
COPY apps/brain-film ./apps/brain-film
COPY deploy/aliyun ./deploy/aliyun

RUN mkdir -p /data

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "deploy/aliyun/start-container.mjs"]
