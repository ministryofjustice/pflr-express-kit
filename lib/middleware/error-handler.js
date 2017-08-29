const logger = require('../logger')

const init = (options = {}) => {
  const { GA_TRACKING_ID } = options
  const external = {}

  external._fallbackError = (req, res, errCode = 500) => {
    if (errCode >= 500) {
      res.send(`We are currently experiencing difficulties (${errCode})`)
    }
  }

  external._resRenderCallback = (err, rendered, req, res, errCode) => {
    if (err) {
      external._fallbackError(req, res, errCode)
    } else {
      res.send(rendered)
    }
  }

  external.render = (req, res, errCode) => {
    res.status(errCode)
    if (!req.hasGlobalMethods) {
      external._fallbackError(req, res, errCode)
      return
    }
    const route = {
      id: errCode
    }
    if (errCode === 401) {
      req.disqualified = true
    }
    const errTemplate = errCode > 500 ? 500 : errCode
    res.render(`templates/error/${errTemplate}`, {
      route,
      errCode,
      GA_TRACKING_ID,
      req
    }, (err, rendered) => {
      external._resRenderCallback(err, rendered, req, res, errCode)
    })
  }

  external.handle = (err, req, res, next) => {
    // if (res.headersSent) {
    //   return next(err)
    // }
    if (err) {
      logger(req.originalUrl, err)
      let errCode = Number(err.message.toString())
      if (isNaN(errCode)) {
        errCode = 500
      }
      external.render(req, res, errCode)
    }
  }

  const compromisedRegex = /([ ,\\/\\.]|%20)+$/
  external.notFound = (req, res) => {
    // check that url has not been compromised by poor email formatting
    if (req.url.match(compromisedRegex)) {
      let redirect = req.url.replace(compromisedRegex, '')
      res.redirect(redirect)
      return
    }
    external.render(req, res, 404)
  }

  return external
}

module.exports = init
