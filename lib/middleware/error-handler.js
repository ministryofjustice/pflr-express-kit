const logger = require('../logger')
const { GA_TRACKING_ID } = process.env

function render (req, res, errCode) {
  const route = {
    id: errCode
  }
  if (errCode === 500) {
    res.sendStatus(errCode)
    return
  }
  res.status(errCode)
  res.render(`templates/error/${errCode}`, {
    route,
    errCode,
    GA_TRACKING_ID
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
