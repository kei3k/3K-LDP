FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Start the application with host binding
CMD ["npm", "run", "dev", "--", "--host"]
