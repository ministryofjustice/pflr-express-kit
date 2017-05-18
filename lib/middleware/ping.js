const { APP_VERSION, APP_BUILD_DATE, APP_GIT_COMMIT, APP_BUILD_TAG, ROUTES } = require('../constants')
const pingPayload = {
  version_number: APP_VERSION,
  build_date: APP_BUILD_DATE,
  commit_id: APP_GIT_COMMIT,
  build_tag: APP_BUILD_TAG
}

let PING_URL = ROUTES.ping

const init = (options = {}) => {
  if (options.url) {
    PING_URL = options.url
  }
  return (req, res, next) => {
    if (req.originalUrl === PING_URL) {
      ping(req, res)
    } else {
      next()
    }
  }
}

const ping = (req, res) => {
  res.json(pingPayload)
}

module.exports = {
  init,
  ping
}

/*
app.use('/ping.json', ping.ping)
app.use(ping.init())
app.use(ping.init({url: '/wag'}))
*/
