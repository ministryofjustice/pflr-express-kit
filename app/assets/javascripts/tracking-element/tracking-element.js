'use strict';

jQuery(function () {
  var trackFirstImpressionOnly = false;
  var threshold = 0.5;
  var impressionTrackerElements = [];
  var elements = [];
  // document.querySelectorAll('#content [id]') ??
  jQuery('#footer, .SummaryArea, .Step, section[id]').each(function (index, elem) {
    elements.push('#' + elem.id);
    impressionTrackerElements.push({
      id: elem.id,
      trackFirstImpressionOnly: trackFirstImpressionOnly,
      threshold: threshold
    });
  });

  ga('require', 'impressionTracker', {
    elements: impressionTrackerElements
  });

  var reportMap = {};

  // key
  //   - time
  //   - top/bottom
  var frequency = 1;

  var windowHasFocus = true;
  jQuery(window).on('blur', function () {
    windowHasFocus = false;
  }).on('focus', function () {
    windowHasFocus = true;
  });

  var reportElements = function reportElements() {
    if (!windowHasFocus) {
      return;
    }
    var windowHeight = jQuery(window).height();
    var windowWidth = jQuery(window).width();
    jQuery.each(elements, function (index, selector) {
      var $elem = jQuery(selector);
      var bounds = $elem.get(0).getBoundingClientRect();
      if (bounds.bottom >= 0 && bounds.top <= windowHeight && bounds.right >= 0 && bounds.left <= windowWidth) {
        if (!reportMap[selector]) {
          reportMap[selector] = {
            elapsed: 0
          };
        }
        reportMap[selector].elapsed += frequency;
      }
    });
  };
  var path = document.location.pathname.replace(/\?.*/, '');
  window.addEventListener('beforeunload', function () {
    for (var prop in reportMap) {
      ga('send', 'event', {
        eventCategory: 'Element Visibility',
        eventAction: prop.replace(/#/, ''),
        eventLabel: path,
        eventValue: reportMap[prop].elapsed
      });
    }
  });
  setInterval(reportElements, frequency * 1000);
});