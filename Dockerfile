FROM node:8.4.0

# Install yarn
RUN curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version 0.27.5
RUN ln -sf /root/.yarn/bin/yarn /usr/local/bin/yarn

# Create app directory
RUN mkdir -p /usr/app
WORKDIR /usr/app
ENV PATH=/usr/app/node_modules/.bin:$PATH

# Install node modules
COPY package.json yarn.lock ./
RUN yarn install --ignore-scripts --ignore-optional

# Copy config files
# COPY .babelrc .eslintrc.js ./
# COPY .babelrc ./

# Copy lib
COPY lib ./lib

# Copy standalone test files
COPY spec ./spec

# Copy app
COPY app ./app
# COPY scripts ./scripts

# Build static files
# COPY src ./src
# RUN yarn run build
RUN yarn run build:css

# Copy data
COPY metadata ./metadata

EXPOSE 3000
CMD [ "node", "lib/start.js" ]