// Disable indexing of svgs
// https://github.com/18F/pa11y-crawl/issues/4

const robotsTesting = () => {
  return (req, res, next) => {
    if (req.originalUrl === '/robots.txt') {
      return res.send(`User-agent: *
  disallow: /public`)
    }
    next()
  }
}

module.exports = robotsTesting
