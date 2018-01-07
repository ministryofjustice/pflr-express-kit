'use strict';

function unsetCheckbox(inputs) {
  inputs.prop('checked', false);
  inputs.closest('label').removeClass('selected');
  inputs.each(function (input) {
    var $input = jQuery(inputs[input]);
    if ($input.attr('aria-expanded')) {
      $input.attr('aria-expanded', false);
      var $target = jQuery('#' + $input.parent().attr('data-target'));
      $target.addClass('js-hidden').attr('aria-hidden', true);
    }
    if ($input.attr('aria-controls')) {
      var $ariaControlled = jQuery('#' + $input.attr('aria-controls'));
      $ariaControlled.addClass('js-hidden').attr('aria-hidden', true);
    }
  });
}
jQuery(document).ready(function () {
  jQuery('[data-excludes]').prev('input').attr('data-excludes-input', true).on('change', function () {
    if (this.checked) {
      var inputs = jQuery(this).closest('fieldset').find('> .multiple-choice > input').not(this);
      unsetCheckbox(inputs);
    }
  }).closest('fieldset').find('> .multiple-choice > input').not('[data-excludes-input]').on('change', function () {
    if (this.checked) {
      var inputs = jQuery(this).closest('fieldset').find('[data-excludes-input]');
      unsetCheckbox(inputs);
    }
  });
});
