# Stage 1: Dependencies
FROM node:20-alpine
WORKDIR /front-end

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm i

# Copy dependencies from deps stage
COPY . .

# Env (document port/key expectation)
ENV PORT=3000

# Expose container port
EXPOSE 3000

# Build the application
CMD ["npm", "run", "build", "--", "-H", "0.0.0.0", "-p", "3000"]