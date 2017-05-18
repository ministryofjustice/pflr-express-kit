const execSync = require('child_process').execSync
const interfaces = require('os').networkInterfaces()
const iface = process.env.interface || 'en0'

let hostIp
if (interfaces[iface]) {
  hostIp = interfaces[iface].filter(i => i.family === 'IPv4').map(i => i.address)[0]
}

const baseProtocol = process.env.baseProtocol || 'http'
let basePort = process.env.basePort === undefined ? 3000 : process.env.basePort
if (basePort) {
  basePort = `:${basePort}`
}
const baseIp = process.env.baseIp || hostIp
const baseUrl = process.env.baseUrl || `${baseProtocol}://${baseIp}${basePort}`
const seleniumProtocol = process.env.seleniumProtocol || 'http'
const seleniumPort = process.env.seleniumPort || 4444
const seleniumIp = process.env.seleniumIp || hostIp
const seleniumUrl = `${seleniumProtocol}://${seleniumIp}:${seleniumPort}`

// Check that app and selenium are up and running
try {
  execSync(`curl -I -s ${baseUrl}`)
} catch (e) {
  console.log(`App is not reachable at ${baseUrl}`)
  process.exit(1)
}
try {
  execSync(`curl -I -s ${seleniumUrl}`)
} catch (e) {
  console.log(`Selenium instance is not reachable at ${seleniumUrl}`)
  if (process.env.seleniumIp) {
    process.exit(1)
  }
  console.log(`Attempting to start Selenium instance`)
  execSync('docker run --name cait-selenium -p 4444:4444 -d selenium/standalone-firefox:3.1.0')
  execSync('sleep 10')
}

console.log('Codecept config', {baseUrl, seleniumUrl})

const tests = process.env.tests || `spec/functional/*.functional.spec.js`
const output = process.env.output || `reports`

const config = {
  tests,
  timeout: 10000,
  output,
  helpers: {
    WebDriverIO: {
      url: baseUrl,
      browser: 'firefox',
      protocol: seleniumProtocol,
      host: seleniumIp,
      port: seleniumPort,
      path: '/wd/hub'
    }
  },
  bootstrap: false,
  mocha: {},
  name: 'pflr-express-kit'
}

exports.config = config
