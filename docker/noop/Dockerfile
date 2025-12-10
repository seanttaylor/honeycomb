FROM node:22-alpine

RUN mkdir /src

COPY ./index.js /src
COPY ./service.js /src
COPY ./package.json /src
COPY ./package-lock.json /src

RUN chown node -R /src

WORKDIR /src

EXPOSE 3001

RUN npm ci --omit=dev

CMD [ "npm", "run", "start" ]