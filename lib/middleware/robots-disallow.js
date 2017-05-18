// Disable indexing of service

const robotsDisallow = () => {
  return (req, res, next) => {
    res.header({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
      'X-Robots-Tag': 'noindex,nofollow'
    })
    if (req.originalUrl === '/robots.txt') {
      return res.send(`User-agent: *
  disallow: /`)
    }
    next()
  }
}

module.exports = robotsDisallow
