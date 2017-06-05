import test from 'ava'

const request = require('request-promise-native')

process.env.ENV = 'testing'
process.env.PORT = 4000
process.env.APP_VERSION = 'APP_VERSION'
process.env.APP_BUILD_DATE = 'APP_BUILD_DATE'
process.env.APP_GIT_COMMIT = 'APP_GIT_COMMIT'
process.env.APP_BUILD_TAG = 'APP_BUILD_TAG'

test.before('setup', t => {
  return new Promise((resolve) => {
    const server = require('./server')
    server.start({
      callback: () => resolve()
    })
  })
})

test('ping.json', t => {
  return request('http://localhost:4000/ping.json')
    .then(res => {
      t.deepEqual(JSON.parse(res), {
        version_number: 'APP_VERSION',
        build_date: 'APP_BUILD_DATE',
        commit_id: 'APP_GIT_COMMIT',
        build_tag: 'APP_BUILD_TAG'
      }, 'Loaded ping file successfully')
    })
    .catch(() => t.fail('Failed to load ping file'))
})

test('404', t => {
  return request('http://localhost:4000/nosuchpath')
    .then(res => t.fail('Unexpectedly found some content'))
    .catch((e) => {
      t.is(e.response.statusCode, 404, 'Received 404 response')
    })
})
