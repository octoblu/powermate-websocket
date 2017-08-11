#!/bin/bash

# docker run --rm -it --volume $PWD:/work \
#   --env-file .env \
#   octoblu/meshblu-connector-builder:linux-armv7 /bin/bash

docker run --rm \
  --volume $PWD:/work \
  --volume /work/node_modules \
  --env-file .env \
  octoblu/meshblu-connector-builder:linux-armv7 \
    bash -c 'export HOME=/tmp/cache \
      && meshblu-connector-pkger \
      && meshblu-connector-installer-debian --destination-path=/usr/local/bin
    '
