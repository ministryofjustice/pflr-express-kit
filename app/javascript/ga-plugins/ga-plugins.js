// https://github.com/googleanalytics/autotrack
(function () {
  const dimensions = {
    HIT_EVENT_TYPE: 7,
    QUERY_DIMENSION: 8,
    BREAKPOINT: 9,
    PIXEL_DENSITY: 10,
    DEVICE_ORIENTATION: 11
  }
  const metrics = {
    MAX_SCROLL: 4,
    PAGE_VISIBLE_TIME: 5
  }

  window.ga = window.ga || function () {
    (ga.q = ga.q || []).push(arguments)
  }

  // Anonymise all the ips!
  ga('set', 'anonymizeIp', true)

  // cleanUrlTracker
  ga('require', 'cleanUrlTracker', {
    stripQuery: true,
    queryDimensionIndex: dimensions.QUERY_DIMENSION,
    indexFilename: 'index.html',
    trailingSlash: 'remove'
  })

  // outboundLinkTracker
  // NB. actually tracks internal links too
  let linkType = ''
  ga('require', 'outboundLinkTracker', {
    events: ['click', 'contextmenu'],
    shouldTrackOutboundLink: (link, parseUrl) => {
      linkType = link.getAttribute('data-link-type')
      return true
    },
    hitFilter: model => {
      // send url as action
      // send data-link-type as label
      // send eventType as custom dimension
      let eventType = model.get('eventAction')
      let eventAction = model.get('eventLabel')
      if (eventType) {
        model.set('dimension' + dimensions.HIT_EVENT_TYPE, eventType, true)
      }
      // is the url an internal link? First kludge for IE
      if (!window.location.origin) {
        window.location.origin = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '')
      }
      if (eventAction.indexOf(window.location.origin) === 0) {
        model.set('eventCategory', 'Internal Link', true)
        eventAction = eventAction.replace(window.location.origin, '')
      }
      model.set('eventAction', eventAction, true)
      model.set('eventLabel', linkType, true)
      // clear linkType
      linkType = ''
    }
  })

  // pageVisibilityTracker
  ga('require', 'pageVisibilityTracker', {
    visibleMetricIndex: metrics.PAGE_VISIBLE_TIME
  })

  // mediaQueryTracker
  ga('require', 'mediaQueryTracker', {
    definitions: [
      {
        name: 'Breakpoint',
        dimensionIndex: dimensions.BREAKPOINT,
        items: [
          {name: 's', media: 'all'},
          {name: 'm', media: '(min-width: 740px)'},
          {name: 'l', media: '(min-width: 1080px)'}
        ]
      },
      {
        name: 'Pixel Density',
        dimensionIndex: dimensions.PIXEL_DENSITY,
        items: [
          {name: '1x', media: 'all'},
          {name: '1.5x', media: '(min-resolution: 144dpi)'},
          {name: '2x', media: '(min-resolution: 192dpi)'}
        ]
      },
      {
        name: 'Device Orientation',
        dimensionIndex: dimensions.DEVICE_ORIENTATION,
        items: [
          {name: 'landscape', media: '(orientation: landscape)'},
          {name: 'portrait', media: '(orientation: portrait)'}
        ]
      }
    ]
  })
  // maxScrollTracker
  ga('require', 'maxScrollTracker', {
    maxScrollMetricIndex: metrics.MAX_SCROLL
  })
})()
