# Use Node.js 20 Alpine image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json (or yarn.lock) files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the entire application code
COPY . .

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 3003

# Start the application in production mode
CMD ["npm", "run", "start:prod"]
