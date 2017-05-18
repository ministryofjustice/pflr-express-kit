const router = require('express').Router()

const nunjucksRouter = () => {
  router.use(/^\/([^.]+)$/, (req, res, next) => {
    const template = req.params[0]
    const context = {}
    var path = `templates/${template}`
    res.render(path, context, function (err, html) {
      if (err) {
        res.render(path + '/index', context, function (err2, html) {
          if (err2) {
            next()
          } else {
            res.send(html)
          }
        })
      } else {
        res.send(html)
      }
    })
  })
  return router
}

module.exports = nunjucksRouter
