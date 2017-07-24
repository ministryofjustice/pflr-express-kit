'use strict'

const robots = (options = {}) => {
  if (options.disallow) {
    options.headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
      'X-Robots-Tag': 'noindex,nofollow'
    }
    options.body = `User-agent: *
disallow: /`
  }
  return (req, res, next) => {
    if (options.headers) {
      res.header(options.headers)
    }
    if (req.originalUrl === '/robots.txt') {
      return res.send(options.body || '')
    }
    next()
  }
}

module.exports = robots
