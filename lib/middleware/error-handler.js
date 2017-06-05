const logger = require('../logger')
const { GA_TRACKING_ID } = process.env

function fallbackError (req, res, errCode = 500) {
  if (errCode >= 500) {
    res.send(`We are currently experiencing difficulties (${errCode})`)
  }
}

function render (req, res, errCode) {
  res.status(errCode)
  if (!req.hasGlobalMethods) {
    fallbackError(req, res, errCode)
    return
  }
  const route = {
    id: errCode
  }
  res.render(`templates/error/${errCode}`, {
    route,
    errCode,
    GA_TRACKING_ID,
    req
  }, (err, rendered) => {
    if (err) {
      fallbackError(req, res, errCode)
    } else {
      res.send(rendered)
    }
  })
}
function handle (err, req, res, next) {
  // if (res.headersSent) {
  //   return next(err)
  // }
  if (err) {
    logger(req.originalUrl, err)
    let errCode = Number(err.message.toString())
    if (isNaN(errCode) || errCode > 500) {
      errCode = 500
    }
    render(req, res, errCode)
  }
}

module.exports = {
  render,
  handle
}
