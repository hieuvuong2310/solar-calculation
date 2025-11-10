# Stage 1: Dependencies
FROM node:20-alpine AS build
WORKDIR /front-end

ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyC6AfZDpbC9MBWFCFP38WNLt87dBptBo58

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm i

# Copy dependencies from deps stage
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /front-end
ENV NODE_ENV=production

ENV PATH="/front-end/node_modules/.bin:$PATH"

# Copy only runtime artifacts
COPY --from=build /front-end/package.json ./
COPY --from=build /front-end/.next ./.next
COPY --from=build /front-end/public ./public
COPY --from=build /front-end/node_modules ./node_modules

EXPOSE 3000
# Use PORT env from Cloud Run; next start accepts -p
CMD ["sh", "-c", "next start -p ${PORT:-3000}"]
