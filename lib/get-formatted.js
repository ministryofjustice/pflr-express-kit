'use strict'

// Marked chokes on parentheses inside link parantheses delimiters
// const Markdown = require('markdown').markdown.toHTML
const MarkdownIt = require('markdown-it')()
                      .use(require('markdown-it-abbr'))
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
msgFormats['en-GB'].addFormatters({
  concat: (input, ...rest) => {
    if (!Array.isArray(input)) {
      return input
    }
    input = input.slice()
    const args = {
      comma: ', ',
      and: ' and '
    }
    const concatArgs = rest[1]
    if (concatArgs) {
      concatArgs.forEach(arg => {
        const argParts = arg.match(/(.+?)=(.+)/)
        if (argParts) {
          const argName = argParts[1]
          const argValue = argParts[2].replace(/^"/, '').replace(/"$/, '')
          args[argName] = argValue
        } else {
          args[arg] = true
        }
      })
      if (args.reverse) {
        input = input.reverse()
      }
    }
    let output = ''
    input.forEach((inp, index) => {
      output += `${(index ? (index === input.length - 1 ? args.and : args.comma) : '')}${inp}`
    })
    return output
  }
})

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
    exclude: /<p>\(ii\)/,
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

  function updateFormat (...inputs) {
    let args = {}
    if (typeof inputs[0] === 'object') {
      args = inputs[0]
    } else {
      for (let index = 0, inputsLength = inputs.length; index < inputsLength; index = index + 2) {
        args[inputs[index]] = inputs[index + 1]
      }
    }
    baseArgs = Object.assign({}, baseArgs, args)
    return baseArgs
  }

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
      if (value.includes('[{')) {
        value = value.replace(/(\{){0,1}\[\{(.*?)\}\]/g, (m, m1, m2) => {
          return `{${format(m2, args)}${m1 ? '' : '}'}`
        })
        // value = value.replace(/\[\{/g, '##OPENDOUBLEBRACKET##').replace(/\}\]/g, '##CLOSEDOUBLEBRACKET##')
        // value = format(value, args)
        // value = value.replace(/##OPENDOUBLEBRACKET##/g, '{').replace(/##CLOSEDOUBLEBRACKET##/g, '}')
      }
      formatted = msgFormats[locale].compile(value)(args)
      if (formatted === undefined) {
        formatted = value.replace(/\{/g, '❴').replace(/\}/g, '❵')
      }
    } catch (e) {
      formatted = value + ': ' + e.message
    }
    if (formatted.indexOf('{var:') > -1) {
      formatted = format(formatted, args)
    }
    formatted = formatted.replace(/##PIPE##/g, '!')
    formatted = reformat(formatted, args)
    // formatted = formatted.replace(/##PIPE##/g, '!')
    formatted = formatted.replace(/mailto:\/\//g, 'mailto:')
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
  function getFormattedBodyContent (block, prop, defaultValue, options) {
    let content = getFormattedBody(block, prop, defaultValue, options)
    content = content.replace(/^\s*<p>/, '').replace(/<\/p>\s*$/, '')
    return content
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
        if (!replacer.exclude || !replacer.exclude.test(formattedBody)) {
          formattedBody = formattedBody.replace(replacer.regex, replacer.method)
        }
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
    let prop = 'value'
    if (block.includes('#')) {
      const blockParts = block.split('#')
      block = blockParts[0]
      prop = blockParts[1]
    }
    let value = getFormattedBody(block, prop, defaultValue, options)
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
    let prefixedBlock = block
    if (options.prefix) {
      const prefixRegex = new RegExp('^' + options.prefix)
      block = block.replace(prefixRegex, '')
    }
    const error = getError(prefixedBlock, options)
    let formattedError = error
    if (typeof error === 'object') {
      let errorType = options.header ? 'error-header' : 'error'
      formattedError = getBlockProp(block, `${errorType}_${error.name}`) || getBlockProp(errorType, error.name)
    }
    formattedError = format(formattedError, {
      control: getFormattedBodyContent(block, 'label'),
      name: block,
      argument: error.argument
    })
    if (options.markdown !== false && !formattedError.includes('<')) {
      formattedError = Markdown(formattedError)
    }
    return formattedError
  }

  return Object.assign(BlockMethods, {
    updateFormat,
    format,
    markdown,
    getFormatted,
    getFormattedProp,
    getFormattedBodyContent,
    getFormattedBody,
    getString,
    getError,
    getFormattedError
  })
}

module.exports = {
  setFormat
}
