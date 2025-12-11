FROM node:22-alpine

RUN mkdir /src

COPY ./docker/hc2/index.js /src
COPY ./docker/hc2/service.js /src
COPY ./docker/hc2/package.json /src
COPY ./docker/hc2/package-lock.json /src
COPY ./docker/hc2/.env /src

RUN chown node -R /src

WORKDIR /src

EXPOSE 3001

RUN npm install

CMD [ "npm", "start" ]