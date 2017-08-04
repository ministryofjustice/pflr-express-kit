const path = require('path')

const app = process.env.PWD
const frontendKitDir = __dirname

const appDir = path.join(app, 'app')
const kitAppDir = path.join(frontendKitDir, 'app')

module.exports = {
  map: false,
  plugins: {
    'postcss-import': {
      path: [
        path.join(appDir, 'css'),
        path.join(kitAppDir, 'css'),
        path.join(appDir, 'templates'),
        path.join(kitAppDir, 'templates'),
        path.join(appDir, 'components'),
        path.join(kitAppDir, 'components'),
        path.join(appDir, 'assets', 'stylesheets'),
        path.join(kitAppDir, 'assets', 'stylesheets')
      ]},
    'postcss-cssnext': {},
    'postcss-discard-duplicates': {},
    'postcss-discard-comments': {},
    'postcss-discard-empty': {}
  }
}
