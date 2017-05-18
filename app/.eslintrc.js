module.exports = Object.assign({}, require('../.eslintrc'), {
  env: {
    browser: true,
    jquery: true,
    es6: true
  },
  globals: {
    GOVUK: true,
    YT: true,
    ga: true,
    GA_TRACKING_ID: true
  }
})