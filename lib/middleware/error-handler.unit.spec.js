const test = require('tape')
const { stub, spy } = require('sinon')

const MockExpressRequest = require('mock-express-request')
const MockExpressResponse = require('mock-express-response')

// const invokeMiddleware = require('../spec/mock-middleware')

const getMocks = (options = {}) => {
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

const errorHandler = require('./error-handler')

const errorMocks = (hasGlobalMethods = true, errorHandlerOptions = {}) => {
  const mocks = getMocks({
    req: {
      hasGlobalMethods
    }
  })
  const errorHandlerInstance = errorHandler(errorHandlerOptions)
  return Object.assign({ errorHandlerInstance }, mocks)
}

test('When fallback method is called', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const sendStub = stub(res, 'send')

  const expectedBody = (code) => `We are currently experiencing difficulties (${code})`

  errorHandlerInstance.fallbackError(req, res, 404)
  t.equal(sendStub.notCalled, true, 'should not send a response for status codes below 500')

  errorHandlerInstance.fallbackError(req, res, 500)
  t.equal(sendStub.calledWith(expectedBody(500)), true, 'should send correct repsonse for status code 500')

  sendStub.reset()
  errorHandlerInstance.fallbackError(req, res, 700)
  t.equal(sendStub.calledWith(expectedBody(700)), true, 'should send correct repsonse for status codes above 500')

  t.end()
})

test('When render method is called but request has no global methods', t => {
  const { req, res, errorHandlerInstance } = errorMocks(false)
  const fallbackErrorSpy = spy(errorHandlerInstance, 'fallbackError')

  errorHandlerInstance.render(req, res, 404)
  t.deepEqual(fallbackErrorSpy.calledWith(req, res, 404), true, 'should invoke the fallbackError method with same arguments')

  t.end()
})

test('When render method is called and request has global methods', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const renderSpy = spy(res, 'render')

  errorHandlerInstance.render(req, res, 404)
  t.equal(renderSpy.calledWith('templates/error/404', {
    route: {
      id: 404
    },
    errCode: 404,
    GA_TRACKING_ID: undefined,
    req,
    _locals: undefined
  }), true, 'should pass the correct arguments to the template')

  t.end()
})

test('When render method is called and request has global methods', t => {
  const { req, res, errorHandlerInstance } = errorMocks(true, { GA_TRACKING_ID: 'trackme' })
  const renderSpy = spy(res, 'render')

  errorHandlerInstance.render(req, res, 404)
  t.equal(renderSpy.firstCall.args[1].GA_TRACKING_ID, 'trackme', 'should pass the correct arguments to the template')

  t.end()
})

test('When res render method succeeds', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const sendSpy = spy(res, 'send')

  errorHandlerInstance.resRenderCallback(null, 'output', req, res)
  t.equal(sendSpy.calledWith('output'), true, 'should sent the rendered output')

  t.end()
})

test('When res render method fails', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const sendSpy = spy(res, 'send')
  const fallbackErrorSpy = spy(errorHandlerInstance, 'fallbackError')

  errorHandlerInstance.resRenderCallback(new Error('an error occurred'), 'bogus output', req, res, 503)
  t.equal(sendSpy.calledWith('output'), false, 'should not send any rendered output')
  t.equal(fallbackErrorSpy.calledWith(req, res, 503), true, 'should call the fallback method with req, res and errCode')

  t.end()
})
