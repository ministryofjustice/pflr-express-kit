const MockExpressRequest = require('mock-express-request')
const MockExpressResponse = require('mock-express-response')

const external = {}

external.getMocks = (options = {}) => {
  const req = new MockExpressRequest(options.req)
  const res = new MockExpressResponse(options.res)
  res.calledNext = false
  const next = () => {
    res.calledNext = true
  }
  return {
    req,
    res,
    next
  }
}

external.invoke = (middleware, t, options) => {
  const { req, res, next } = external.getMocks({
    req: {
      originalUrl: options.url
    }
  })

  const assertNextCalled = (called = true) => {
    t.is(res.calledNext, called, `next middleware should${called ? '' : ' not'} be called`)
  }
  const assertStatusCode = (expected, description) => {
    const code = res.statusCode
    t.is(code, expected, description || `response status code should be ${code}`)
  }
  const assertBody = (expected, description) => {
    const body = res._responseData.toString()
    t.is(body, expected, description || `response body should be ${body}`)
  }
  const assertJSON = (expected, description) => {
    const json = JSON.parse(res._responseData.toString())
    t.deepEqual(json, expected, description || `response json should be ${JSON.stringify(json)}`)
  }
  const assertHeaders = (headers) => {
    const resHeaders = res._headers
    Object.keys(headers).forEach(headerName => {
      const header = headers[headerName]
      const headerValue = typeof header === 'string' ? header : header.value
      t.equal(resHeaders[headerName], headerValue, header.description || `${headerName} header should be ${headerValue}`)
    })
  }

  if (options.err) {
    middleware(options.err, req, res, next)
  } else {
    middleware(req, res, next)
  }
  return {
    req,
    res,
    next,
    assertNextCalled,
    assertStatusCode,
    assertBody,
    assertJSON,
    assertHeaders
  }
}

external.invokeUrl = (middleware, t, url, options = {}) => {
  options = Object.assign({}, options, { url })
  return external.invoke(middleware, t, options)
}

external.invokeError = (middleware, t, err, options = {}) => {
  options = Object.assign({}, options, { err })
  return external.invoke(middleware, t, options)
}

module.exports = external
