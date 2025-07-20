FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose API port
EXPOSE 8000

# Start the application
CMD ["node", "dist/app.js"]