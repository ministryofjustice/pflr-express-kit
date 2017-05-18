const basicAuth = require('basic-auth')
const router = require('express').Router()

const { USERNAME, PASSWORD } = process.env

const auth = (credentials = { username: USERNAME, password: PASSWORD }) => {
  const { username, password } = credentials
  if (!username) {
    return (req, res, next) => {
      next()
    }
  }
  router.use((req, res, next) => {
    if (req.connection.remoteAddress.includes('127.0.0.1')) {
      return next()
    }
    function unauthorized (res) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
      return res.sendStatus(401)
    }

    const user = basicAuth(req)

    if (!user || !user.name || !user.pass) {
      return unauthorized(res)
    }
    if (user.name === username && user.pass === password) {
      return next()
    } else {
      return unauthorized(res)
    }
  })
  return router
}

module.exports = auth
