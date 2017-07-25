const test = require('tape')
const proxyquire = require('proxyquire')
const { invokeUrl } = require('../spec/mock-express-middleware')

const constants = {
  APP_VERSION: 'APP_VERSION',
  APP_BUILD_DATE: 'APP_BUILD_DATE',
  APP_GIT_COMMIT: 'APP_GIT_COMMIT',
  APP_BUILD_TAG: 'APP_BUILD_TAG'
}

var ping = proxyquire('./ping', {
  '../constants': constants
})

const pingPayload = {
  version_number: constants.APP_VERSION,
  build_date: constants.APP_BUILD_DATE,
  commit_id: constants.APP_GIT_COMMIT,
  build_tag: constants.APP_BUILD_TAG
}

const defaultPing = ping.init()

test('When using default ping configuration and a user agent requests ping.json', t => {
  t.plan(3)

  const { assertNextCalled, assertStatusCode, assertJSON } = invokeUrl(defaultPing, t, '/ping.json')

  assertNextCalled(false)
  assertStatusCode(200)
  assertJSON(pingPayload)
})

test('When using default ping configuration and a user agent requests any other resource', t => {
  t.plan(2)

  const { assertNextCalled, assertStatusCode } = invokeUrl(defaultPing, t, '/foo')

  assertNextCalled(true)
  assertStatusCode(200)
})

const customPing = ping.init({url: '/ping.alt'})

test('When using custom ping configuration and a user agent requests the ping file', t => {
  t.plan(3)

  const { assertNextCalled, assertStatusCode, assertJSON } = invokeUrl(customPing, t, '/ping.alt')

  assertNextCalled(false)
  assertStatusCode(200)
  assertJSON(pingPayload)
})

const explicitPing = ping.ping

test('When using explicit ping configuration and a user agent requests the ping file', t => {
  t.plan(3)

  const { assertNextCalled, assertStatusCode, assertJSON } = invokeUrl(explicitPing, t)

  assertNextCalled(false)
  assertStatusCode(200)
  assertJSON(pingPayload)
})
