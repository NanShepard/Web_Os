# Use a lightweight Node.js 18 image as the base
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Install Docker CLI so the Node server can spawn containers
RUN apk add --no-cache docker-cli

# Copy the rest of the application files
COPY . .

# Ensure cloud_data directory exists (optional, handled by code as well)
RUN mkdir -p /app/cloud_data

# The server listens on port 8080 by default
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Start the Node.js application
CMD ["npm", "start"]
