jQuery(function () {
  const trackFirstImpressionOnly = false
  const threshold = 0.5
  const impressionTrackerElements = []
  const elements = []
  // document.querySelectorAll('#content [id]') ??
  jQuery('#footer, .SummaryArea, .Step, section[id]').each((index, elem) => {
    elements.push('#' + elem.id)
    impressionTrackerElements.push({
      id: elem.id,
      trackFirstImpressionOnly,
      threshold
    })
  })

  ga('require', 'impressionTracker', {
    elements: impressionTrackerElements
  })

  const reportMap = {}

  // key
  //   - time
  //   - top/bottom
  const frequency = 1

  let windowHasFocus = true
  jQuery(window)
    .on('blur', () => { windowHasFocus = false })
    .on('focus', () => { windowHasFocus = true })

  const reportElements = () => {
    if (!windowHasFocus) {
      return
    }
    const windowHeight = jQuery(window).height()
    const windowWidth = jQuery(window).width()
    jQuery.each(elements, (index, selector) => {
      const $elem = jQuery(selector)
      const bounds = $elem.get(0).getBoundingClientRect()
      if (bounds.bottom >= 0 && bounds.top <= windowHeight && bounds.right >= 0 && bounds.left <= windowWidth) {
        if (!reportMap[selector]) {
          reportMap[selector] = {
            elapsed: 0
          }
        }
        reportMap[selector].elapsed += frequency
      }
    })
  }
  const path = document.location.pathname.replace(/\?.*/, '')
  window.addEventListener('beforeunload', function () {
    for (let prop in reportMap) {
      ga('send', 'event', {
        eventCategory: 'Element Visibility',
        eventAction: prop.replace(/#/, ''),
        eventLabel: path,
        eventValue: reportMap[prop].elapsed
      })
    }
  })
  setInterval(reportElements, frequency * 1000)
})
