'use strict'

let get = require('lodash/get')

function matchProp (obj, matchArray) {
  if (!Array.isArray(matchArray)) {
    matchArray = [matchArray]
  }
  for (let i = 0, dLength = matchArray.length; i < dLength; i++) {
    let matchStatus = true
    let checkDependency = matchArray[i]
    Object.keys(checkDependency).forEach(key => {
      let matchInverse
      let matchString = checkDependency[key]
      if (key.indexOf('!') === 0) {
        matchInverse = true
        key = key.replace(/!\s*/, '')
      }
      let matchedKeys = matchKeys(obj, key)
      if (!matchedKeys.length) {
        matchedKeys = [key]
      }
      let matched
      for (let j = 0, mkLength = matchedKeys.length; j < mkLength; j++) {
        matched = matchKeyValue(matchString, matchedKeys[j], obj)
        if (matched) {
          break
        }
      }
      if (matchInverse) {
        matched = !matched
      }
      if (!matched) {
        matchStatus = false
      }
    })
    if (matchStatus) {
      return true
    }
  }
  return false
}

function matchKeyValue (matchString, key, obj) {
  let matched
  let keyValue = get(obj, key)
  keyValue = keyValue !== undefined ? keyValue.toString() : keyValue
  if (typeof matchString === 'boolean') {
    matchString = matchString.toString()
  }
  if (typeof keyValue === 'string') {
    if (matchString.indexOf('<') === 0 || matchString.indexOf('>') === 0) {
      let numberComparisonMatch = matchString.match(/^(([<>]={0,1})\s*(\d+(\.\d+){0,1}))\s*(,\s*([<>]={0,1})\s*(\d+(\.\d+){0,1})){0,1}$/)
      let compareNumber = (a, comp, b) => {
        a = Number(a)
        b = Number(b)
        if (comp === '<') {
          return a < b
        } else if (comp === '>') {
          return a > b
        } else if (comp === '<=') {
          return a <= b
        } else if (comp === '>=') {
          return a >= b
        }
      }
      matched = compareNumber(keyValue, numberComparisonMatch[2], numberComparisonMatch[3])
      if (matched && numberComparisonMatch[7]) {
        matched = compareNumber(keyValue, numberComparisonMatch[6], numberComparisonMatch[7])
      }
    } else {
      let matcher = new RegExp('^' + matchString + '$')
      matched = keyValue.match(matcher)
    }
  } else if (typeof keyValue === 'string') {
  }
  return matched
}

function generateObjKeys (obj, prefix) {
  prefix = prefix || ''
  let keys = []
  for (let key in obj) {
    keys.push(prefix + key)
    let prop = obj[key]
    if (typeof prop === 'object' && !Array.isArray(prop)) {
      keys = keys.concat(generateObjKeys(prop, prefix + key + '.'))
    }
  }
  return keys
}

function matchKeys (obj, matchStr) {
  let keys = generateObjKeys(obj)
  let matchExp = new RegExp('^' + matchStr + '$')
  return keys.filter(key => {
    return !!key.match(matchExp)
  })
}

module.exports = matchProp
