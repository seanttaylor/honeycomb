FROM node:22-alpine

RUN mkdir /src

COPY ./docker/foh/index.js /src
COPY ./docker/foh/service.js /src
COPY ./docker/foh/package.json /src
COPY ./docker/foh/package-lock.json /src
COPY ./docker/foh/.env /src
COPY ./hc2 /src/hc2

RUN chown node -R /src

WORKDIR /src

EXPOSE 3001

RUN npm install

CMD [ "npm", "start" ]