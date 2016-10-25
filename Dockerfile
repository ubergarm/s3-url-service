FROM mhart/alpine-node

RUN apk add --no-cache \
            git

WORKDIR /app

CMD /bin/sh
