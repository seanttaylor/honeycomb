FROM node:22-alpine

RUN mkdir /src

COPY ./docker/noop/index.js /src
COPY ./docker/noop/service.js /src
COPY ./docker/noop/package.json /src
COPY ./docker/noop/package-lock.json /src
COPY ./docker/noop/.env /src
COPY ./hc2 /src/hc2

RUN chown node -R /src

WORKDIR /src

EXPOSE 3001

RUN npm install

CMD [ "npm", "start" ]