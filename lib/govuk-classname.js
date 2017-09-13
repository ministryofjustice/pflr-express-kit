let kitType = 'all'

const classMap = {
  frontendkit: {
    'bold-xxlarge': 'bold-xxlarge',
    'bold-xlarge': 'bold-xlarge',
    'bold-medium': 'bold-medium',
    'bold-small': 'bold-small',
    'bold-xsmall': 'bold-xsmall',
    'button': 'button',
    'button-start': 'button button-start',
    'column-full': 'column-full',
    'column-one-half': 'column-one-half',
    'column-one-quarter': 'column-one-quarter',
    'column-one-third': 'column-one-third',
    'column-two-thirds': 'column-two-thirds',
    'data': 'data',
    'data-item': 'data-item',
    'error-message': 'error-message',
    'error-summary': 'error-summary',
    'error-summary-heading': 'error-summary-heading',
    'error-summary-list': 'error-summary-list',
    'font-xxlarge': 'font-xxlarge',
    'font-xlarge': 'font-xlarge',
    'font-medium': 'font-medium',
    'font-small': 'font-small',
    'font-xsmall': 'font-xsmall',
    'form-block': 'form-block',
    'form-control': 'form-control',
    'form-control-error': 'form-control-error',
    'form-group': 'form-group',
    'form-group-error': 'form-group-error',
    'form-hint': 'form-hint',
    'form-label': 'form-label',
    'form-label-bold': 'form-label-bold',
    'govuk-govspeak': 'govuk-govspeak',
    'grid-row': 'grid-row',
    'heading-xlarge': 'heading-xlarge',
    'heading-large': 'heading-large',
    'heading-medium': 'heading-medium',
    'heading-small': 'heading-small',
    'inline': 'inline',
    'inset': 'panel panel-border-wide info-notice',
    'lede': 'lede',
    'list': 'list',
    'list-bullet': 'list list-bullet',
    'list-number': 'list list-number',
    'multiple-choice': 'multiple-choice',
    'notice': 'notice',
    'notice-icon': 'icon icon-important',
    'notice-fallback': 'visually-hidden',
    'notice-text': 'bold-small',
    'numeric': 'numeric',
    'phase-banner': 'phase-banner',
    'phase-tag': 'phase-tag',
    'js-hidden': 'js-hidden',
    'connected': 'panel panel-border-narrow',
    'summary-details': 'panel panel-border-narrow',
    'visually-hidden': 'visually-hidden',
    'gv-c-phase-banner__content': 'NOT_MAPPED',
    'gv-c-phase-banner__text': 'NOT_MAPPED',
    'gv-o-wrapper': 'NOT_MAPPED',
    'gv-u-heading-large': 'NOT_MAPPED',
    'gv-u-text-bold-large': 'NOT_MAPPED',
    'gv-u-text-large': 'NOT_MAPPED'
  },
  alpha: {
    'bold-xxlarge': 'NOT_MAPPED',
    'bold-xlarge': 'gv-u-text-bold-xxlarge',
    'bold-large': 'gv-u-text-bold-xlarge',
    'bold-medium': 'gv-u-text-bold-medium',
    'bold-small': 'gv-u-text-bold-small',
    'bold-xsmall': 'gv-u-text-bold-xsmall',
    'button': 'gv-c-button',
    'button-start': 'gv-c-button gv-c-button--start',
    'column-full': 'gv-o-grid-item gv-u-full',
    'column-one-half': 'gv-o-grid-item gv-u-one-half',
    'column-one-quarter': 'gv-o-grid-item gv-u-one-quarter',
    'column-one-third': 'gv-o-grid-item gv-u-one-third',
    'column-two-thirds': 'gv-o-grid-item gv-u-two-thirds',
    'data': 'TODO',
    'data-item': 'TODO',
    'error-message': 'TODO',
    'error-summary': 'TODO',
    'error-summary-heading': 'TODO',
    'error-summary-list': 'TODO',
    'font-xxlarge': 'NOT_MAPPED',
    'font-xlarge': 'gv-u-text-xxlarge',
    'font-large': 'gv-u-text-xlarge',
    'font-medium': 'gv-u-text-medium',
    'font-small': 'gv-u-text-small',
    'font-xsmall': 'gv-u-text-xsmall',
    'form-block': 'TODO',
    'form-control': 'TODO',
    'form-control-error': 'TODO',
    'form-group': 'gv-c-form-group',
    'form-group-error': 'gv-c-form-group--has-error',
    'form-hint': 'TODO',
    'form-label': 'TODO',
    'form-label-bold': 'TODO',
    'govuk-govspeak': 'gv-s-prose',
    'grid-row': 'gv-o-grid-row',
    'heading-xlarge': 'gv-u-heading-xxlarge',
    'heading-large': 'gv-u-heading-xlarge',
    'heading-medium': 'gv-u-heading-medium',
    'heading-small': 'gv-u-heading-small',
    'inline': 'TODO',
    'inset': 'TODO',
    'lede': 'gv-u-text-lede',
    'list': 'gv-c-list',
    'list-bullet': 'gv-c-list gv-c-list--bullet',
    'list-number': 'gv-c-list gv-c-list--number',
    'multiple-choice': 'TODO',
    'notice': 'gv-c-notice',
    'notice-icon': 'gv-c-notice__icon gv-c-notice__icon--important',
    'notice-fallback': 'gv-c-notice__icon-fallback-text',
    'notice-text': 'gv-c-notice__text',
    'numeric': 'TODO',
    'phase-banner': 'gv-c-phase-banner',
    'phase-tag': 'gv-c-phase-tag',
    'js-hidden': 'TODO',
    'connected': 'TODO',
    'visually-hidden': 'TODO',
    'gv-c-phase-banner__content': 'gv-c-phase-banner__content',
    'gv-c-phase-banner__text': 'gv-c-phase-banner__text',
    'gv-o-wrapper': 'gv-o-wrapper',
    'gv-u-heading-large': 'gv-u-heading-large',
    'gv-u-text-bold-large': 'gv-u-text-bold-large',
    'gv-u-text-large': 'gv-u-text-large'
  }
}
//  'large': 'h2',
//   'medium': 'h3',
//   'small'
const kits = Object.keys(classMap)
const keys = Object.keys(classMap.frontendkit)
const allKeys = {}
keys.forEach(key => {
  let keyOutput = ''
  kits.forEach(kit => {
    keyOutput += ' ' + classMap[kit][key]
  })
  allKeys[key] = keyOutput
})
classMap.all = allKeys
// gv-u-heading

const govukClassname = (key) => {
  return classMap[kitType][key] || key
}

govukClassname.init = (kit) => {
  if (classMap[kit]) {
    kitType = kit
  }
}

module.exports = govukClassname
