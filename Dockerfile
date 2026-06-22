FROM node:22-alpine

ENV PORT=5900

WORKDIR /app

RUN apk add --no-cache wget \
    && wget -O server.js https://raw.githubusercontent.com/bxbzzbbbm-cmyk/vigilant-octo-waffle/refs/heads/main/server.js \
    && npm install express

EXPOSE 5900

CMD ["node", "server.js"]
