# Stage 1: Dependencies
FROM node:20-alpine
WORKDIR /front-end

# Copy package files
COPY package.json package-lock.json* ./
COPY scripts ./scripts

# Install dependencies
RUN npm ci

# Copy dependencies from deps stage
COPY . .


# Build the application
CMD [ "npm", "run", "dev" ]

