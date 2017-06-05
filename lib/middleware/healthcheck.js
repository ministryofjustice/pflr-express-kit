const request = require('request-promise-native')
const { PORT, ROUTES } = require('../constants')

let HEALTHCHECK_URL = ROUTES.healthcheck
let TEST_URL = `http://localhost:${PORT}`
let VALIDATE_RESPONSE_METHOD

const init = (validateHealthcheck, options = {}) => {
  if (options.url) {
    HEALTHCHECK_URL = options.url
  }
  if (validateHealthcheck) {
    VALIDATE_RESPONSE_METHOD = validateHealthcheck
  }
  return (req, res, next) => {
    if (req.originalUrl === HEALTHCHECK_URL) {
      if (options.fakeHealthcheck) {
        res.json({
          status: true,
          content: {
            statusCode: 200
          }
        })
      } else {
        healthcheck(req, res)
      }
    } else {
      next()
    }
  }
}

const healthcheck = (req, res) => {
  let status = true
  let statusCode
  request(TEST_URL)
    .then(html => {
      statusCode = 200
      if (VALIDATE_RESPONSE_METHOD) {
        status = VALIDATE_RESPONSE_METHOD(html)
      }
    })
    .catch(err => {
      status = false
      statusCode = err.statusCode
    })
    .then(() => {
      res.status(status ? 200 : 500)
      res.json({
        status,
        content: {
          statusCode
        }
      })
    })
}

module.exports = {
  init,
  healthcheck
}
