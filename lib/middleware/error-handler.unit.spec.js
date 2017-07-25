const test = require('tape')
const { stub, spy } = require('sinon')

const { getMocks, invokeError } = require('../spec/mock-express-middleware')

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
  const resSendStub = stub(res, 'send')

  const expectedBody = (code) => `We are currently experiencing difficulties (${code})`

  errorHandlerInstance._fallbackError(req, res, 404)
  t.true(resSendStub.notCalled, 'should not send a response for status codes below 500')

  errorHandlerInstance._fallbackError(req, res, 500)
  t.true(resSendStub.calledWith(expectedBody(500)), 'should send correct repsonse for status code 500')

  resSendStub.reset()
  errorHandlerInstance._fallbackError(req, res, 700)
  t.true(resSendStub.calledWith(expectedBody(700)), 'should send correct repsonse for status codes above 500')

  t.end()
})

test('When render method is called but request has no global methods', t => {
  const { req, res, errorHandlerInstance } = errorMocks(false)
  const fallbackErrorSpy = spy(errorHandlerInstance, '_fallbackError')
  errorHandlerInstance.render(req, res, 404)

  t.deepEqual(fallbackErrorSpy.calledWith(req, res, 404), true, 'should invoke the fallbackError method with same arguments')
  t.end()
})

test('When render method is called and request has global methods', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const resRenderSpy = spy(res, 'render')
  errorHandlerInstance.render(req, res, 404)

  t.true(resRenderSpy.calledWith('templates/error/404', {
    route: {
      id: 404
    },
    errCode: 404,
    GA_TRACKING_ID: undefined,
    req,
    _locals: undefined
  }), 'should pass the correct arguments to the template')
  t.end()
})

test('When render method is called with an errCode greater than 500', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const resRenderSpy = spy(res, 'render')
  errorHandlerInstance.render(req, res, 503)

  t.true(resRenderSpy.calledWith('templates/error/500'), 'should render the 500 error template')
  t.end()
})

test('When render method is called and request has global methods', t => {
  const { req, res, errorHandlerInstance } = errorMocks(true, { GA_TRACKING_ID: 'trackme' })
  const resRenderSpy = spy(res, 'render')
  errorHandlerInstance.render(req, res, 404)

  t.equal(resRenderSpy.firstCall.args[1].GA_TRACKING_ID, 'trackme', 'should pass the correct arguments to the template')
  t.end()
})

test('When res render method succeeds', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const resSendSpy = spy(res, 'send')
  errorHandlerInstance._resRenderCallback(null, 'output', req, res)

  t.true(resSendSpy.calledWith('output'), 'should sent the rendered output')
  t.end()
})

test('When res render method fails', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const resSendSpy = spy(res, 'send')
  const fallbackErrorSpy = spy(errorHandlerInstance, '_fallbackError')
  errorHandlerInstance._resRenderCallback(new Error('an error occurred'), 'bogus output', req, res, 503)

  t.false(resSendSpy.calledWith('output'), 'should not send any rendered output')
  t.true(fallbackErrorSpy.calledWith(req, res, 503), 'should call the fallback method with req, res and errCode')
  t.end()
})

test('When express throws an error', t => {
  const { assertNextCalled, assertStatusCode } = invokeError(errorHandler().handle, t, new Error(404))

  assertNextCalled(false)
  assertStatusCode(404)
  t.end()
})

test('When res render method fails', t => {
  const { assertStatusCode } = invokeError(errorHandler().handle, t, new Error('404'))

  assertStatusCode(404)
  t.end()
})

test('When res render method fails', t => {
  const { assertStatusCode } = invokeError(errorHandler().handle, t, new Error(503))

  assertStatusCode(503)
  t.end()
})

test('When res render method fails', t => {
  const { assertStatusCode } = invokeError(errorHandler().handle, t, new Error('an error occurred'))

  assertStatusCode(500)
  t.end()
})

test('When notFound handler called', t => {
  const { req, res, errorHandlerInstance } = errorMocks()
  const renderSpy = spy(errorHandlerInstance, 'render')
  errorHandlerInstance.notFound(req, res)

  t.true(renderSpy.calledWith(req, res, 404), 'should render 404')
  t.end()
})
