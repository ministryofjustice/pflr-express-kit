'use strict'

// Marked chokes on parentheses inside link parantheses delimiters
let Markdown = require('markdown').markdown.toHTML
let MessageFormat = require('messageformat')

let msgFormats = {}
msgFormats['en-GB'] = new MessageFormat('en-GB')
let defaultLocale = 'en-GB'

let BlockMethods = require('./get-block')
let marshallDefaultValue = BlockMethods.marshallDefaultValue
let getBlock = BlockMethods.getBlock
let getBlockProp = BlockMethods.getBlockProp

function setFormat (baseArgs, options) {
  baseArgs = baseArgs || {}
  options = options || {}
  let locale = options.locale || defaultLocale
  let errors = options.errors || []

  let recurseMatch = /!\s*([\S]+?)\s*!/
  function reformat (value, args) {
    if (value.match(recurseMatch)) {
      value = value.replace(recurseMatch, (m, m1) => {
        let keyParams = m1.trim()
        // TODO: allow to pass in params
        let keyName = keyParams
        let keyProp = 'value'
        if (keyParams.includes('#')) {
          let keysParamsChunks = keyParams.split('#')
          keyName = keysParamsChunks[0]
          keyProp = keysParamsChunks[1]
        } else {

        }
        let nestedValue = getFormattedProp(keyName, keyProp, undefined, {args})
        return nestedValue
      })
      value = reformat(value, args)
    }
    return value
  }
  function markdown (value) {
    return Markdown(value)
  }
  function format (value, args) {
    if (!value) {
      return ''
    }
    if (typeof value !== 'string') {
      return value.toString()
    }

    if ((value.indexOf('{') === -1) && !value.match(recurseMatch)) {
      return value
    }
    args = args || baseArgs

    value = value.replace(/!/g, '##PIPE##')
    let formatted
    try {
      formatted = msgFormats[locale].compile(value)(args)
    } catch (e) {
      formatted = value + ': ' + e.message
    }
    formatted = formatted.replace(/##PIPE##/g, '!')
    formatted = reformat(formatted, args)
    // formatted = formatted.replace(/##PIPE##/g, '!')
    return formatted
  }
  function getFormatted (block, defaultValue, options) {
    options = marshallDefaultValue(defaultValue, options)
    let value = getBlock(block, options)
    return format(value, options.args)
  }
  function getFormattedProp (block, prop, defaultValue, options) {
    options = marshallDefaultValue(defaultValue, options)
    let value = getBlockProp(block, prop, options)
    return format(value, options.args) // .replace(/ ([^ ]+)$/, '&nbsp;$1')
  }
  function getFormattedBody (block, prop, defaultValue, options) {
    options = marshallDefaultValue(defaultValue, options)
    let value = getBlockProp(block, prop || 'body', Object.assign({}, options))
    if (value === undefined && !prop) {
      value = getBlock(block, options)
    }
    if (value) {
      value = value.trim()
    }
    let formattedBody = format(value, options.args)
    if (options.markdown !== false) {
      formattedBody = Markdown(formattedBody)
      formattedBody = formattedBody.replace(/<ol>/g, '<ol class="list list-number">')
      formattedBody = formattedBody.replace(/<ul>/g, '<ul class="list list-bullet">')
      formattedBody = formattedBody.replace(/<h1>/g, '<h1 class="heading-xlarge">')
      formattedBody = formattedBody.replace(/<h2>/g, '<h2 class="heading-large">')
      formattedBody = formattedBody.replace(/<h3>/g, '<h3 class="heading-medium">')
    }
    //  | trim | replace("\n", "</p><p>"
    return formattedBody
  }
  function getString (block, defaultValue, options) {
    let value = getFormattedBody(block, 'value', defaultValue, options)
    if (value) {
      value = value.replace(/^\s*<p>/, '').replace(/<\/p>\s*$/, '')
    }
    return value
  }
  function getError (block, options) {
    options = options || {}
    let error = options.error
    if (!error && errors) {
      error = errors[block] ? errors[block] : ''
    }
    return error
  }
  function getFormattedError (block, options) {
    options = options || {}
    let error = getError(block, options)
    let formattedError = error
    if (typeof error === 'object') {
      let errorType = options.header ? 'error-header' : 'error'
      formattedError = getBlockProp(errorType + ':' + error.name, 'value')
    }
    return format(formattedError, {
      control: getFormattedProp(block, 'label'),
      argument: error.argument
    })
  }

  return Object.assign(BlockMethods, {
    format,
    markdown,
    getFormatted,
    getFormattedProp,
    getFormattedBody,
    getString,
    getError,
    getFormattedError
  })
}

module.exports = {
  setFormat
}
