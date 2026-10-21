# Image of the front, in two stages: Node builds the static files, nginx
# serves them. The final image contains no Node.

FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite writes the VITE_ variables into the JavaScript at build time: the API
# address is a build argument, passed by compose, not a runtime variable.
ARG VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
