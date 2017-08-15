'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Adapted from https://philipwalton.com/articles/the-google-analytics-setup-i-use-on-every-site-i-build
(function () {
  var dimensions = {
    TRACKING_VERSION: 'dimension1',
    CLIENT_ID: 'dimension2',
    WINDOW_ID: 'dimension3',
    HIT_ID: 'dimension4',
    HIT_TIME: 'dimension5',
    HIT_TYPE: 'dimension6'
  };

  var metrics = {
    RESPONSE_END_TIME: 'metric1',
    DOM_LOAD_TIME: 'metric2',
    WINDOW_LOAD_TIME: 'metric3'
  };

  var TRACKING_VERSION = '1.0.1';

  var uuid = function b(a) {
    return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, b);
  };

  window.ga = window.ga || function () {
    (ga.q = ga.q || []).push(arguments);
  };
  ga('create', GA_TRACKING_ID, 'auto');
  ga('set', 'transport', 'beacon');

  // Tracking version
  ga('set', dimensions.TRACKING_VERSION, TRACKING_VERSION);

  // Client ID (and send the pageview)
  ga(function (tracker) {
    var clientId = tracker.get('clientId');
    tracker.set(dimensions.CLIENT_ID, clientId);
    // Send the pageview
    ga('send', 'pageview');
  });

  // Window ID
  ga('set', dimensions.WINDOW_ID, uuid());

  // Hit enhancements
  ga(function (tracker) {
    var originalBuildHitTask = tracker.get('buildHitTask');
    tracker.set('buildHitTask', function (model) {
      model.set(dimensions.HIT_ID, uuid(), true);
      model.set(dimensions.HIT_TIME, String(+new Date()), true);
      model.set(dimensions.HIT_TYPE, model.get('hitType'), true);

      originalBuildHitTask(model);
    });
  });

  if (window.setValues) {
    for (var val in window.setValues) {
      ga('set', val, window.setValues[val]);
    }
  }

  // Error handling
  var trackError = function trackError(error) {
    var fieldsObj = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    ga('send', 'event', Object.assign({
      eventCategory: 'Script',
      eventAction: 'error',
      eventLabel: error && error.stack || '(not set)',
      nonInteraction: true
    }, fieldsObj));
  };

  var trackErrors = function trackErrors() {
    var loadErrorEvents = window.__e && window.__e.q ? window.__e.q : [];
    var fieldsObj = { eventAction: 'uncaught error' };

    // Replay any stored load error events.
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = loadErrorEvents[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var event = _step.value;

        trackError(event.error, fieldsObj);
      }

      // Add a new listener to track event immediately.
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    window.addEventListener('error', function (event) {
      trackError(event.error, fieldsObj);
    });
  };

  // Send any errors
  ga(function () {
    trackErrors();
  });

  // Track performance
  var sendNavigationTimingMetrics = function sendNavigationTimingMetrics() {
    // Only track performance in supporting browsers.
    if (!(window.performance && window.performance.timing)) return;

    // If the window hasn't loaded, run this function after the `load` event.
    if (document.readyState !== 'complete') {
      window.addEventListener('load', sendNavigationTimingMetrics);
      return;
    }

    var nt = performance.timing;
    var navStart = nt.navigationStart;

    var responseEnd = Math.round(nt.responseEnd - navStart);
    var domLoaded = Math.round(nt.domContentLoadedEventStart - navStart);
    var windowLoaded = Math.round(nt.loadEventStart - navStart);

    // In some edge cases browsers return very obviously incorrect NT values,
    // e.g. 0, negative, or future times. This validates values before sending.
    var allValuesAreValid = function allValuesAreValid() {
      for (var _len = arguments.length, values = Array(_len), _key = 0; _key < _len; _key++) {
        values[_key] = arguments[_key];
      }

      return values.every(function (value) {
        return value > 0 && value < 1e6;
      });
    };

    if (allValuesAreValid(responseEnd, domLoaded, windowLoaded)) {
      var _ga;

      ga('send', 'event', (_ga = {
        eventCategory: 'Navigation Timing',
        eventAction: 'track',
        eventLabel: JSON.stringify({ responseEnd: responseEnd, domLoaded: domLoaded, windowLoaded: windowLoaded }),
        nonInteraction: true
      }, _defineProperty(_ga, metrics.RESPONSE_END_TIME, responseEnd), _defineProperty(_ga, metrics.DOM_LOAD_TIME, domLoaded), _defineProperty(_ga, metrics.WINDOW_LOAD_TIME, windowLoaded), _ga));
    }
  };

  // Send performance data
  sendNavigationTimingMetrics();
})();