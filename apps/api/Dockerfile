# syntax=docker/dockerfile:1
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @ems/api --ignore-scripts --no-audit --no-fund

FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache font-dejavu \
    && mkdir -p /opt/ems-fonts \
    && find /usr/share/fonts -name DejaVuSans.ttf -exec cp {} /opt/ems-fonts/DejaVuSans.ttf \; \
    && test -f /opt/ems-fonts/DejaVuSans.ttf \
    && rm -rf /usr/local/lib/node_modules/npm /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=dependencies /app/node_modules ./node_modules
COPY apps/api/package.json ./package.json
COPY apps/api/src ./src
COPY apps/api/scripts ./scripts
COPY apps/api/migrations ./migrations
COPY --chmod=755 deploy/docker-entrypoint.sh /usr/local/bin/ems-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["ems-entrypoint"]
CMD ["src/server.js"]
