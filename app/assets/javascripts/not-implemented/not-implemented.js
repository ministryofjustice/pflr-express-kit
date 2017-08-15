'use strict';

jQuery(document).ready(function () {
  jQuery('.add-note, .schedule-reminder, .share-plan, nav .print, nav .share, nav .edit, .plan_step_by_step_submit button, .action-note-add button, .skipped-action').on('click', function (e) {
    var $el = jQuery(this);
    var feature = $el.text() || $el.val();
    var featureDialog$ = jQuery('#feature_dialog');
    var notImplemented$ = jQuery('#not_implemented');
    if (!notImplemented$.get(0)) {
      jQuery('body').append('<div id="feature_dialog"><div class="dialog-content"><p class="dialog-close">× Close</p><h2 id="not_implemented">Not implemented</h2><p id="not_implemented"></p><p>What would you expect this feature to do?</p></div></div>');
      notImplemented$ = jQuery('#not_implemented');
      featureDialog$ = jQuery('#feature_dialog');
      featureDialog$.on('click', function () {
        jQuery(this).hide();
      });
    }
    notImplemented$.html(feature);
    featureDialog$.show();
    e.preventDefault();
  });
});