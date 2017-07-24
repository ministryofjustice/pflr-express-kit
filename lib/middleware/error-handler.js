const logger = require('../logger')

const init = (options = {}) => {
  const { GA_TRACKING_ID } = options
  const external = {}

  external.fallbackError = (req, res, errCode = 500) => {
    if (errCode >= 500) {
      res.send(`We are currently experiencing difficulties (${errCode})`)
    }
  }

  external.resRenderCallback = (err, rendered, req, res, errCode) => {
    if (err) {
      external.fallbackError(req, res, errCode)
    } else {
      res.send(rendered)
    }
  }

  external.render = (req, res, errCode) => {
    res.status(errCode)
    if (!req.hasGlobalMethods) {
      external.fallbackError(req, res, errCode)
      return
    }
    const route = {
      id: errCode
    }
    // const callback = external.renderCallback(req, res, errCode)
    res.render(`templates/error/${errCode}`, {
      route,
      errCode,
      GA_TRACKING_ID,
      req
    }, (err, rendered) => {
      external.resRenderCallback(err, rendered, req, res, errCode)
    })
  }

  external.handle = (err, req, res, next) => {
    // if (res.headersSent) {
    //   return next(err)
    // }
    if (err) {
      logger(req.originalUrl, err)
      let errCode = Number(err.message.toString())
      if (isNaN(errCode) || errCode > 500) {
        errCode = 500
      }
      external.render(req, res, errCode)
    }
  }

  return external
}

module.exports = init
