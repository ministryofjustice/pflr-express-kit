'use strict'

let coreMethods = {
  get: () => {},
  set: () => {},
  destroy: () => {},
  getRaw: () => {},
  getAll: () => {},
  getKeys: () => {}
}

function setLocalisation (methods) {
  coreMethods = Object.assign({}, coreMethods, methods)
}

function marshallDefaultValue (defaultValue, options) {
  if (typeof defaultValue === 'object') {
    options = defaultValue
    defaultValue = options['defaultValue']
  }
  options = options || {}
  options['defaultValue'] = defaultValue
  return options
}

function getBlock (block, defaultValue, options) {
  options = marshallDefaultValue(defaultValue, options)
  if ((!options.valueStrict && options.value) || (options.valueStrict && options.value !== undefined)) {
    return options.value
  }
  defaultValue = options['defaultValue']
  delete options['defaultValue']
  let path = block
  if (options.prop) {
    if (Array.isArray(options.prop)) {
      for (let i = 0, pLength = options.prop.length; i < pLength; i++) {
        let value = coreMethods.get(path + '.' + options.prop[i])
        if ((!options.propStrict && value) || (options.propStrict && value !== undefined)) {
          return value
        }
      }
      return defaultValue
    } else {
      path = path + '.' + options.prop
    }
  }
  return coreMethods.get(path, defaultValue)
}
function getBlockProp (block, prop, defaultValue, options) {
  options = marshallDefaultValue(defaultValue, options)
  options.prop = prop
  return getBlock(block, options)
}

function getBlockRaw (block) {
  return coreMethods.getRaw(block)
}

function getBlockVars (block, options) {
  let blockVars = Object.assign({}, getBlock(block, options))
  Object.keys(blockVars).forEach(prop => {
    if (!prop.startsWith('var:')) {
      delete blockVars[prop]
    }
  })
  return blockVars
}

function setBlock (block, value) {
  return coreMethods.set(block, value)
}

function destroyBlock (block) {
  return coreMethods.destroy(block)
}

function setBlockProp (block, prop, value) {
  return coreMethods.set(block + '.' + prop, value)
}

function getKeys (type, enabled) {
  return coreMethods.getKeys(type, enabled)
}

module.exports = {
  setLocalisation,
  marshallDefaultValue,
  getBlock,
  getBlockProp,
  getBlockRaw,
  getBlockVars,
  setBlock,
  setBlockProp,
  destroyBlock,
  getKeys
}
