FROM rust:1.88.0-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
  git \
  build-essential \
  pkg-config \
  libssl-dev \
  protobuf-compiler \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Install rustfmt
RUN rustup component add rustfmt

# Clone DWEB repo
WORKDIR /usr/src
RUN git clone https://codeberg.org/happybeing/dweb.git

# Build
WORKDIR /usr/src/dweb
RUN cargo build --release

EXPOSE 5537

CMD ["./target/release/dweb", "serve", "--port", "5537", "--host", "0.0.0.0"]



