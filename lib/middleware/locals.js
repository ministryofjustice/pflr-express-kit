const locals = (ENV, assetPath, env) => {
  assetPath = `/${assetPath}/`
  const protocol = ENV ? 'https' : 'http'
  return (req, res, next) => {
    res.locals.asset_path = assetPath
    res.locals.ENV = ENV
    res.locals.env = env
    req.ENV = ENV
    req.env = env
    req.servername = `${protocol}://${req.headers.host}`
    next()
  }
}

module.exports = locals
