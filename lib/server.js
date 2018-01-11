const path = require('path')
const express = require('express')
const Raven = require('raven')

// Express middleware
const session = require('express-session')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const morgan = require('morgan')
const favicon = require('serve-favicon')
const compression = require('compression')

const constants = require('./constants')

const { ENV, PORT, ASSET_PATH, ASSET_SRC_PATH, GA_TRACKING_ID } = constants

const logger = require('./logger')
const auth = require('./auth')

const ping = require('./middleware/ping')
const healthcheck = require('./middleware/healthcheck')
const robots = require('./middleware/robots')
const locals = require('./middleware/locals')
const routesStatic = require('./middleware/routes-static')
const routesCached = require('./middleware/routes-cached')
const routesNunjucks = require('./middleware/routes-nunjucks')
const errorHandler = require('./middleware/error-handler')({ GA_TRACKING_ID })

const nunjucksConfigure = require('./nunjucks-configure')

const start = (options = {}) => {
  const appDir = process.cwd()
  const kitLibDir = __dirname
  const kitDir = path.resolve(kitLibDir, '..')
  const cacheDir = path.join(appDir, ASSET_PATH, 'html')

  const routesMetadata = require('./routes-metadata.js')

  const app = express()

  const sentryDSN = constants.SENTRY_DSN
  if (sentryDSN) {
    Raven.config(sentryDSN).install()
    app.use(Raven.requestHandler())
  }

  app.disable('x-powered-by')

  // Set views engine
  app.set('view engine', 'html')

  // Configure nunjucks
  const nunjucksOptions = options.nunjucks || ENV ? {} : {
    noCache: true,
    watch: true
  }
  nunjucksConfigure(app, appDir, kitDir, nunjucksOptions)

  // Configure logging
  const loggingPreset = ENV ? 'combined' : 'dev'
  app.use(morgan(loggingPreset, {
    skip: () => ENV === 'testing'
  }))

  // Set Favicon
  app.use(favicon(path.join(appDir, 'node_modules', 'govuk_frontend_alpha', 'assets', 'images', 'template', 'favicon.ico')))

  // Ping route
  app.use(ping.init())

  // Healthcheck route
  app.use(healthcheck.init(options.validateHealthcheck, options))

  // Disable indexing of svgs
  // https://github.com/18F/pa11y-crawl/issues/4
  if (ENV === 'testing') {
    options.robots = {
      body: `User-agent: *
disallow: /public`
    }
  }

  // Robots
  app.use(robots(options.robots))

  // Gzip content
  app.use(compression())

  // Support session data
  // TODO: LOOK TO FIX THIS UP
  app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: Math.round(Math.random() * 100000).toString()
  }))

  // Support for parsing data in POSTs
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({
    extended: true
  }))

  // Enable reading of cookies
  app.use(cookieParser())

  // Local values
  app.use(locals(ENV, ASSET_PATH, process.env))

  // Run arbitrary routes before static routes run
  if (options.preStaticRoutes) {
    app.use(options.preStaticRoutes())
  }

  // Serve static assets
  app.use(routesStatic(appDir, kitDir, ASSET_PATH, ASSET_SRC_PATH))

  // Run arbitrary routes after static routes run
  if (options.postStaticRoutes) {
    app.use(options.postStaticRoutes())
  }

  // TODO: remove need for this TERRIBLE kludge
  // allows other routes to use the format and block methods
  // This needs to be here to cater for any dynamic routes called before we hit the static ones
  app.use(routesMetadata.globalMethods)

  // Run everything through basic auth
  app.use(auth(options.basicAuth))

  // Screen users if necessary
  if (options.screenUsers) {
    app.use(options.screenUsers(ENV))
  }

  // Run arbitrary routes before cached output served
  if (options.cached) {
    app.use(options.cached())
  }

  // Serve cached output
  app.use(routesCached(cacheDir, ASSET_PATH))

  // Run arbitrary routes after cached output served
  if (options.postCached) {
    app.use(options.postCached())
  }

  // Metadata-based routes
  app.use(routesMetadata({cacheDir, appDir, kitDir}))

  // Simple nunjucks routes
  app.use(routesNunjucks())

  // if we got here it's not found
  app.use(errorHandler.notFound)

  // Sentry reports errors
  if (sentryDSN) {
    // app.use(Raven.errorHandler())
    const sentryHandler = Raven.errorHandler()
    app.use((err, req, res, next) => {
      const errCode = Number(err.message.toString())
      if (isNaN(errCode) || errCode >= 500) {
        sentryHandler(err, req, res, next)
      } else {
        errorHandler.handle(err, req, res)
      }
    })
  }

  // Handle any errors
  app.use(errorHandler.handle)

  // Fire up the app
  const server = app.listen(PORT, () => {
    logger('App is running on localhost:' + PORT)
    if (options.callback) {
      options.callback(server, app)
    }
  })
}

module.exports = {
  start
}
