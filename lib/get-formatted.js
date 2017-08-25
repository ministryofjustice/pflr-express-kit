'use strict'

// Marked chokes on parentheses inside link parantheses delimiters
// const Markdown = require('markdown').markdown.toHTML
const MarkdownIt = require('markdown-it')()
                      .use(require('markdown-it-deflist'))
                      .use(require('markdown-it-sup'))
                      .use(require('markdown-it-sub'))
const Markdown = (str) => {
  return MarkdownIt.render(str)
}
const MessageFormat = require('messageformat')

const msgFormats = {}
msgFormats['en-GB'] = new MessageFormat('en-GB')
const defaultLocale = 'en-GB'

const BlockMethods = require('./get-block')
const { marshallDefaultValue, getBlock, getBlockProp } = BlockMethods

// TODO: pass customReplacers in as part of setup
const govukClassname = require('./govuk-classname')

const hiddenPrefix = `<span class="accessibility-hidden">` //  `<span class="${govukClassname('hidden')}">`
const hiddenSuffix = '</span>'
const insetPrefix = `<div role="note" aria-label="Information" class="${govukClassname('inset')}">`
const insetSuffix = '</div>'
const noticePrefix = `<div role="note" aria-label="Warning" class="${govukClassname('notice')}"><i class="${govukClassname('notice-icon')}"><span class="${govukClassname('notice-fallback')}">Warning</span></i><strong class="${govukClassname('notice-text')}">`
const noticeSuffix = '</strong></div>'

const customReplacers = [
  {
    regex: /(<a [^>]+)>(.+?)\|(.+?)<\/a>/g,
    method: (m, m1, m2, m3) => `${m1} aria-label="${m3.replace(/^\s+/, '')}">${m2.replace(/\s+$/, '')}</a>`
  },
  {
    regex: /\(h\)(.*?)\(\/h\)/g,
    method: (m) => hiddenPrefix + m.replace(/\(h\)(.*?)\(\/h\)/g, '$1') + hiddenSuffix
  },
  {
    regex: /(<p>\(i\)([\s\S]+?)<\/p>\s*)+/g,
    method: (m) => insetPrefix + m.replace(/<p>\(i\)\s*/g, '<p>') + insetSuffix
  },
  {
    regex: /(<p>\(!\)([\s\S]+?)<\/p>\s*)+/g,
    method: (m) => noticePrefix + m.replace(/<p>\(!\)\s*(.*?)<\/p>/g, '$1') + noticeSuffix
  }
]

function setFormat (baseArgs, options) {
  baseArgs = baseArgs || {}
  options = options || {}
  const locale = options.locale || defaultLocale
  const errors = options.errors || []

  const recurseMatch = /!\s*([\S]+?)\s*!/
  function reformat (value, args) {
    if (value.match(recurseMatch)) {
      value = value.replace(recurseMatch, (m, m1) => {
        const keyParams = m1.trim()
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
    const value = getBlock(block, options)
    return format(value, options.args)
  }
  function getFormattedProp (block, prop, defaultValue, options) {
    options = marshallDefaultValue(defaultValue, options)
    const value = getBlockProp(block, prop, options)
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
    }

    customReplacers.forEach(replacer => {
      if (replacer.regex.test(formattedBody)) {
        formattedBody = formattedBody.replace(replacer.regex, replacer.method)
      }
    })

    // Allow attributes to be applied to elements
    formattedBody = formattedBody.replace(/<([^>]+)>(((?!<\1>).)+?)\s*;;;\s*([^<]+?)<\/\1>/g, (m, m1, m2, m3, m4) => {
      return `<${m1} ${m4}>${m2}</${m1}>`.replace(/&quot;/g, '"')
    })
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
    const error = getError(block, options)
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
