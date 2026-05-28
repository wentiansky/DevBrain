FROM pgvector/pgvector:pg16

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    wget \
    bzip2 \
    git \
    postgresql-server-dev-16 \
  && rm -rf /var/lib/apt/lists/* \
  && wget -O /tmp/scws.tar.bz2 http://www.xunsearch.com/scws/down/scws-1.2.3.tar.bz2 \
  && tar -xjf /tmp/scws.tar.bz2 -C /tmp \
  && cd /tmp/scws-1.2.3 \
  && ./configure --prefix=/usr/local \
  && make -j"$(nproc)" \
  && make install \
  && ldconfig \
  && cd /tmp \
  && rm -rf /tmp/scws.tar.bz2 /tmp/scws-1.2.3 \
  && git clone --depth=1 https://github.com/amutu/zhparser.git /tmp/zhparser \
  && cd /tmp/zhparser \
  && PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config SCWS_HOME=/usr/local make \
  && PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config SCWS_HOME=/usr/local make install \
  && rm -rf /tmp/zhparser \
  && apt-get purge -y build-essential git wget bzip2 postgresql-server-dev-16 \
  && apt-get autoremove -y \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
