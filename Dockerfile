# Use official Node.js 20 image from the Docker Hub
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
COPY package*.json ./

# Install dependencies using npm ci (this ensures clean install)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the NestJS application
RUN npm run build

# Expose the application port
EXPOSE 3003

# Set the command to run the application in production
CMD ["npm", "run", "start:prod"]
