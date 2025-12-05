FROM node:20-alpine
WORKDIR /app
# copy only package.json first to leverage Docker layer caching
COPY package.json ./
# use npm install because we don't have a lock file
RUN npm install --no-audit --no-fund
# now copy the rest and build
COPY . .
RUN npm run build
CMD ["npm","start"]
