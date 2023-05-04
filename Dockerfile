FROM node:lts-alpine as build
ARG VITE_APP_NAME="Activity timer (dev)"
ARG VITE_APP_KEY
ARG VITE_WEBSOCKET
ARG VITE_API_HOST
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install
COPY . .
RUN npm run build

FROM caddy as server
COPY --from=build /usr/src/app/dist /usr/src/app/dist
WORKDIR /usr/src/app/dist
CMD [ "caddy", "file-server"]
