const locals = (ENV, assetPath, env) => {
  assetPath = `/${assetPath}/`
  return (req, res, next) => {
    res.locals.asset_path = assetPath
    res.locals.ENV = ENV
    res.locals.env = env
    req.ENV = ENV
    req.env = env
    const protocol = req.headers['x-forwarded-proto'] || req.protocol
    req.servername = `${protocol}://${req.headers.host}`
    next()
  }
}

module.exports = locals
