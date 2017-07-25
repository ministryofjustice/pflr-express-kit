const test = require('tape')
const { invokeUrl } = require('../spec/mock-express-middleware')

const robots = require('./robots')

const defaultHeaders = {
  'access-control-allow-origin': {
    description: 'Access-Control-Allow-Origin header should not be set'
  },
  'access-control-allow-methods': {
    description: 'Access-Control-Allow-Methods header should not be set'
  },
  'access-control-allow-headers': {
    description: 'Access-Control-Allow-Headers header should not be set'
  },
  'x-robots-tag': {
    description: 'X-Robots-Tag header should not be set'
  }
}

const defaultRobots = robots()

test('When using default robots configuration and a user agent requests robots.txt', t => {
  t.plan(7)

  const { assertNextCalled, assertStatusCode, assertBody, assertHeaders } = invokeUrl(defaultRobots, t, '/robots.txt')

  assertNextCalled(false)
  assertStatusCode(200)
  assertBody('', 'empty robots.txt should be returned')
  assertHeaders(defaultHeaders)
})

test('When using default robots configuration and a user agent requests any other resource', t => {
  t.plan(6)

  const { assertNextCalled, assertStatusCode, assertHeaders } = invokeUrl(defaultRobots, t, '/foo')

  assertNextCalled()
  assertStatusCode(200)
  assertHeaders(defaultHeaders)
})

const customTxt = `User-agent: Site Marauder 1.0
                   disallow: /no-go`
const customRobots = robots({ body: customTxt })

test('When using custom configuration and a user agent requests robots.txt', t => {
  t.plan(6)

  const { assertNextCalled, assertBody, assertHeaders } = invokeUrl(customRobots, t, '/robots.txt')

  assertNextCalled(false)
  assertBody(customTxt, 'custom robots.txt should be returned')
  assertHeaders(defaultHeaders)
})

test('When using custom configuration and a user agent requests any other resource', t => {
  t.plan(5)

  const { assertNextCalled, assertHeaders } = invokeUrl(customRobots, t, '/foo')

  assertNextCalled()
  assertHeaders(defaultHeaders)
})

const disallowedHeaders = {
  'access-control-allow-origin': {
    value: '*',
    description: 'Access-Control-Allow-Origin header should be set'
  },
  'access-control-allow-methods': {
    value: 'GET, POST',
    description: 'Access-Control-Allow-Methods header should be set'
  },
  'access-control-allow-headers': {
    value: 'X-Requested-With, content-type, Authorization',
    description: 'Access-Control-Allow-Headers header should be set'
  },
  'x-robots-tag': {
    value: 'noindex,nofollow',
    description: 'X-Robots-Tag header should be set'
  }
}

const disallowRobots = robots({disallow: true})

test('When robots are disallowed and a user agent requests robots.txt', t => {
  t.plan(6)

  const { assertNextCalled, assertBody, assertHeaders } = invokeUrl(disallowRobots, t, '/robots.txt')

  assertNextCalled(false)
  assertBody('User-agent: *\ndisallow: /', 'correct robots.txt should be returned')
  assertHeaders(disallowedHeaders)
})

test('When robots are disallowed and a user agent requests any other resource', t => {
  t.plan(5)

  const { assertNextCalled, assertHeaders } = invokeUrl(disallowRobots, t, '/foo')

  assertNextCalled()
  assertHeaders(disallowedHeaders)
})
