FROM node:alpine
WORKDIR /usr/app
COPY bin ./bin
COPY public ./public
COPY src ./src
COPY package.json .
RUN npm install
EXPOSE 8080 1024
CMD ["npm", "run", "dev"]
