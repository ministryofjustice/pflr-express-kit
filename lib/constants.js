if (!process.env.PORT) {
  process.env.PORT = 3000
}
const { ENV, PORT, APP_VERSION, APP_BUILD_DATE, APP_GIT_COMMIT, APP_BUILD_TAG } = process.env

module.exports = {
  ENV,
  APP_VERSION,
  APP_BUILD_DATE,
  APP_GIT_COMMIT,
  APP_BUILD_TAG,
  PORT,
  ROUTES: {
    ping: '/ping.json',
    healthcheck: '/healthcheck.json'
  },
  ASSET_PATH: 'public',
  ASSET_SRC_PATH: '/public'
}
