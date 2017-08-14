// Adapted from https://philipwalton.com/articles/the-google-analytics-setup-i-use-on-every-site-i-build
(function () {
  const dimensions = {
    TRACKING_VERSION: 'dimension1',
    CLIENT_ID: 'dimension2',
    WINDOW_ID: 'dimension3',
    HIT_ID: 'dimension4',
    HIT_TIME: 'dimension5',
    HIT_TYPE: 'dimension6'
  }

  const metrics = {
    RESPONSE_END_TIME: 'metric1',
    DOM_LOAD_TIME: 'metric2',
    WINDOW_LOAD_TIME: 'metric3'
  }

  const TRACKING_VERSION = '1.0.1'

  const uuid = function b (a) {
    return a ? (a ^ Math.random() * 16 >> a / 4).toString(16)
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, b)
  }

  window.ga = window.ga || function () {
    (ga.q = ga.q || []).push(arguments)
  }
  ga('create', GA_TRACKING_ID, 'auto')
  ga('set', 'transport', 'beacon')

// Tracking version
  ga('set', dimensions.TRACKING_VERSION, TRACKING_VERSION)

// Client ID (and send the pageview)
  ga((tracker) => {
    var clientId = tracker.get('clientId')
    tracker.set(dimensions.CLIENT_ID, clientId)
    // Send the pageview
    ga('send', 'pageview')
  })

  // Window ID
  ga('set', dimensions.WINDOW_ID, uuid())

  // Hit enhancements
  ga((tracker) => {
    const originalBuildHitTask = tracker.get('buildHitTask')
    tracker.set('buildHitTask', (model) => {
      model.set(dimensions.HIT_ID, uuid(), true)
      model.set(dimensions.HIT_TIME, String(+new Date()), true)
      model.set(dimensions.HIT_TYPE, model.get('hitType'), true)

      originalBuildHitTask(model)
    })
  })

  if (window.setValues) {
    for (var val in window.setValues) {
      ga('set', val, window.setValues[val])
    }
  }

  // Error handling
  const trackError = (error, fieldsObj = {}) => {
    ga('send', 'event', Object.assign({
      eventCategory: 'Script',
      eventAction: 'error',
      eventLabel: (error && error.stack) || '(not set)',
      nonInteraction: true
    }, fieldsObj))
  }

  const trackErrors = () => {
    const loadErrorEvents = window.__e && window.__e.q ? window.__e.q : []
    const fieldsObj = {eventAction: 'uncaught error'}

    // Replay any stored load error events.
    for (let event of loadErrorEvents) {
      trackError(event.error, fieldsObj)
    }

    // Add a new listener to track event immediately.
    window.addEventListener('error', (event) => {
      trackError(event.error, fieldsObj)
    })
  }

  // Send any errors
  ga(() => {
    trackErrors()
  })

  // Track performance
  const sendNavigationTimingMetrics = () => {
    // Only track performance in supporting browsers.
    if (!(window.performance && window.performance.timing)) return

    // If the window hasn't loaded, run this function after the `load` event.
    if (document.readyState !== 'complete') {
      window.addEventListener('load', sendNavigationTimingMetrics)
      return
    }

    const nt = performance.timing
    const navStart = nt.navigationStart

    const responseEnd = Math.round(nt.responseEnd - navStart)
    const domLoaded = Math.round(nt.domContentLoadedEventStart - navStart)
    const windowLoaded = Math.round(nt.loadEventStart - navStart)

    // In some edge cases browsers return very obviously incorrect NT values,
    // e.g. 0, negative, or future times. This validates values before sending.
    const allValuesAreValid = (...values) => {
      return values.every((value) => value > 0 && value < 1e6)
    }

    if (allValuesAreValid(responseEnd, domLoaded, windowLoaded)) {
      ga('send', 'event', {
        eventCategory: 'Navigation Timing',
        eventAction: 'track',
        eventLabel: JSON.stringify({responseEnd, domLoaded, windowLoaded}),
        nonInteraction: true,
        [metrics.RESPONSE_END_TIME]: responseEnd,
        [metrics.DOM_LOAD_TIME]: domLoaded,
        [metrics.WINDOW_LOAD_TIME]: windowLoaded
      })
    }
  }

// Send performance data
  sendNavigationTimingMetrics()
})()
