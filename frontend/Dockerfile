# Stage 1: Dependencies
FROM node:20-alpine
WORKDIR /front-end

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy dependencies from deps stage
COPY . .


# Build the application
RUN npm run dev

