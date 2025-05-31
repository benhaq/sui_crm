FROM node:22-alpine AS builder
USER root
RUN apk add --update --no-cache \
    python3 \
    make \
    gcc \
    libsass \
    g++ \
    curl \
    rust \
    cargo \
    git \
    openssl-dev \
    pkgconfig \
    protoc \
    clang \
    clang-dev \
    llvm-dev \
    cmake \
    yarn

COPY . ./
RUN yarn install
RUN yarn build

FROM node:22-slim AS runtime
WORKDIR /usr/src/app

# Extract and setup Sui CLI as root
COPY ./cli/sui.gz /tmp/
RUN gunzip -c /tmp/sui.gz > /usr/local/bin/sui && \
    chmod 755 /usr/local/bin/sui && \
    rm /tmp/sui.gz

# Then setup node user
RUN chown -R node:node /usr/src
USER node
COPY --from=builder ./node_modules ./node_modules
COPY --from=builder ./dist ./dist
ENV PATH="/usr/local/bin:$PATH"
CMD ["node","dist/main"]