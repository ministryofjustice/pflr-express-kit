if (!process.env.PORT) {
  process.env.PORT = 3000
}

const CONSTANTS = Object.assign({}, process.env, {
  ROUTES: {
    ping: '/ping.json',
    healthcheck: '/healthcheck.json'
  },
  ASSET_PATH: 'public',
  ASSET_SRC_PATH: '/public'
})

module.exports = CONSTANTS

/*
APP_BUILD_DATE
APP_BUILD_TAG
APP_GIT_COMMIT
APP_VERSION
ENV
PORT
SENTRY_DSN
*/
