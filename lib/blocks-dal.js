'use strict'

const get = require('lodash/get')
const set = require('lodash/set')
const flattenDeep = require('lodash/flattenDeep')
const cloneDeep = require('lodash/cloneDeep')
const fs = require('fs')
const os = require('os')
const path = require('path')

const appDir = process.cwd()

let blocksSrc = {}

const loadJSON = () => {
  blocksSrc = {}
  const files = fs.readdirSync(jsonDir).filter(f => f.match(/\.json$/))
  files.forEach(name => {
    const key = name.replace(/\.json/, '')
    blocksSrc[key] = require(path.resolve(jsonDir, name))
  })
}

let jsonDir
try {
  jsonDir = path.resolve(appDir, 'metadata', 'blocks', 'en')
  loadJSON()
} catch (e) {
  console.log('No metadata files found')
}

let blocks

function stringify (obj) {
  return JSON.stringify(obj, null, 2)
}

function sortObject (obj) {
  var sortedObj = {}
  Object.keys(obj)
    .sort()
    .forEach(key => {
      sortedObj[key] = obj[key]
      if (typeof sortedObj[key] === 'object' && !Array.isArray(sortedObj[key])) {
        sortedObj[key] = sortObject(sortedObj[key])
      }
    })
  return sortedObj
}
function save (objPath, value) {
  if (!jsonDir) {
    return
  }
  value = sortObject(value)
  const saveSrc = path.join(jsonDir, `${objPath}.json`)
  return new Promise((resolve, reject) => {
    fs.writeFile(saveSrc, stringify(value), err => {
      if (err) {
        reject(err)
      } else {
        resolve(value)
      }
    })
  })
  // blocksSrc = sortObject(blocksSrc)
  // return new Promise((resolve, reject) => {
  //   fs.writeFile(jsonSrc, stringify(blocksSrc), err => {
  //     if (err) {
  //       reject(err)
  //     } else {
  //       resolve(blocksSrc)
  //     }
  //   })
  // })
}

function destroy (objPath) {
  delete blocksSrc[objPath]
  processBlocks()
  if (!jsonDir) {
    return
  }
  const destroySrc = path.join(jsonDir, `${objPath}.json`)
  console.log({destroySrc})
  return new Promise((resolve, reject) => {
    fs.unlink(destroySrc, err => {
      if (err) {
        console.log({err})
        reject(err)
      } else {
        console.log('Unlinked the file')
        resolve(true)
      }
    })
  })
}

function processBlocks () {
  blocks = cloneDeep(blocksSrc)
  let processedBlocks = {}
  function extendBlock (key) {
    let block = blocks[key]
    if (block._isa) {
      let extendedKey = block._isa
      let extendedBlock = blocks[extendedKey]
      if (extendedBlock._isa && !processedBlocks[extendedKey]) {
        extendBlock(extendedKey)
        extendedBlock = blocks[extendedKey]
      }
      block = Object.assign({}, extendedBlock, block)
      // delete block.extends
      blocks[key] = block
      processedBlocks[key] = true
    }
  }
  Object.keys(blocks).forEach(key => {
    extendBlock(key)
  })
  Object.keys(blocks).forEach(key => {
    let block = blocks[key]
    Object.keys(block).forEach(prop => {
      if (prop.match(/^\*/)) {
        let keyToAlias = prop.replace(/^\*/, '')
        if (block[keyToAlias] === undefined) {
          block[keyToAlias] = block[block[prop]]
        }
      } else if (prop.match(/^=/)) {
        let keyToAlias = prop.replace(/^=/, '')
        if (block[keyToAlias] === undefined) {
          let aliasedProp = block[prop]
          let aliasedKeyProp = keyToAlias
          if (aliasedProp.indexOf('=') !== -1) {
            let aliasChunks = aliasedProp.split('=')
            aliasedProp = aliasChunks[0]
            aliasedKeyProp = aliasChunks[1]
          }
          let aliasedPropValue = blocks[aliasedProp][aliasedKeyProp]
          if (Array.isArray(aliasedPropValue)) {
            aliasedPropValue = aliasedPropValue.slice()
          }
          block[keyToAlias] = aliasedPropValue
        }
      }
    })
    // let blocksAlias = blocks[key].blocks_alias
    // if (blocksAlias) {
    //   let aliasedBlocks = blocks[blocksAlias].blocks
    //   blocks[key].blocks = aliasedBlocks.slice()
    // }
  })
  Object.keys(blocks).forEach(key => {
    let keyBlock = blocks[key]
    let overrideKey = 'override--' + key
    let overrideBlock = {
      label: keyBlock.label || keyBlock.heading || keyBlock.title
    }
    if (keyBlock.blocks) {
      let keySubblock = 'override--subblock--' + key
      let dependObj = {}
      dependObj['!' + overrideKey] = 'hide'
      blocks[keySubblock] = {
        type: 'group',
        blocks: keyBlock.blocks.map(function (el) {
          return 'override--' + el
        }),
        depends: [dependObj]
      }
      overrideBlock.subblock = keySubblock
    }
    blocks[overrideKey] = Object.assign({}, blocks['default:overrides-show-hide'], overrideBlock)
  })
  const routes = getKeys('Route')
  getAll('multiple', true).forEach(key => {
    const block = blocks[key]
    if (block._blockType !== 'Group') {
      return
    }
    block.multiple_counter = block.multiple_counter || block._id
    const newBlocks = []
    const min = block.multiple_min !== undefined ? block.multiple_min : 1
    block.multiple_min = min
    const max = block.multiple_max || min || 1
    block.multiple_max = max
    // let referredBlocks = block.blocks.map(blok => blocks[blok])
    // console.log(refer)

    for (let blockCycle = 1; blockCycle <= max; blockCycle++) {
      const newBlock = Object.assign({}, block)
      newBlock.multiple_counter_ref = newBlock.multiple_counter
      delete newBlock.multiple_counter
      if (blockCycle > min) {
        newBlock.depends = [
          {
            [block.multiple_counter]: `>=${blockCycle}`
          }
        ]
      }
      newBlock.multiple_index = blockCycle
      newBlock._autogenerated = true
      const blockSuffix = `_${blockCycle}`
      newBlock._id += blockSuffix
      newBlock.heading = block.multiple_heading ? `${block.multiple_heading} ${blockCycle}` : undefined
      if (newBlock.heading && !newBlock.multiple_autosuffix) {
        newBlock.multiple_autosuffix = false
      }
      delete newBlock.body
      newBlock.blocks = newBlock.blocks.map(blockName => {
        const newBlockReffed = Object.assign({}, blocks[blockName])
        newBlockReffed._id += blockSuffix
        if (newBlockReffed.label !== undefined && (newBlock.multiple_autosuffix !== false)) {
          newBlockReffed.label += ` ${blockCycle}`
        }
        newBlockReffed.group_index = blockCycle
        newBlockReffed.multiple_counter_ref = newBlock.multiple_counter_ref
        if (newBlock.depends) {
          newBlockReffed.depends = newBlock.depends
        }
        blocks[newBlockReffed._id] = newBlockReffed
        return blockName + blockSuffix
      })
      blocks[newBlock._id] = newBlock
      // console.log(JSON.stringify(newBlock, null, 2))
      newBlocks.push(newBlock._id)
    }
    block.blocks = newBlocks
    // routes.forEach(route => {
    //   const routeBlock = blocks[route]
    //   if (routeBlock && routeBlock.blocks) {
    //     let index = routeBlock.blocks.indexOf(key)
    //     if (index > -1) {
    //       routeBlock.blocks.splice(index, 1, newBlocks)
    //       routeBlock.blocks = flattenDeep(routeBlock.blocks)
    //     }
    //   }
    // })
  })
  routes.forEach(key => {
    const block = blocks[key]
    if (block._blockType === 'Route' && block.multiple) {
      const generatedBlocks = []
      const min = block.multiple_min || 0
      const max = block.multiple_max || min
      for (let counter = 1; counter <= max; counter++) {
        const countedRoute = Object.assign({}, block)
        countedRoute.multiple_counter = countedRoute.multiple_counter || countedRoute._id.replace(/route:/, '')
        countedRoute.multiple_route = key
        countedRoute._index = counter
        countedRoute._id += `_${counter}`
        countedRoute.url += `/${counter}`
        // countedRoute._suffix = '_' + counter
        countedRoute._prefix = `${countedRoute.multiple_counter}_${counter}_`
        if (counter > min) {
          countedRoute.depends = [
            {
              [countedRoute.multiple_counter]: `>=${counter}`
            }
          ]
        }
        // console.log('countedRoute', JSON.stringify(countedRoute, null, 2))
        blocks[countedRoute._id] = countedRoute
        generatedBlocks.push(countedRoute._id)
      }
      block._disabled = true
      routes.forEach(innerKey => {
        const innerBlock = blocks[innerKey]
        if (innerBlock.steps) {
          const index = innerBlock.steps.indexOf(key)
          if (index > -1) {
            innerBlock.steps.splice(index, 1, generatedBlocks)
            innerBlock.steps = flattenDeep(innerBlock.steps)
            // console.log(innerBlock.steps)
          }
        }
      })
      // console.log({generatedBlocks})
    }
  })
}
processBlocks()

function getValue (path, defaultValue) {
  return get(blocks, path, defaultValue)
}

function getRawValue (path, defaultValue) {
  return get(blocksSrc, path, defaultValue)
}

function setValue (objPath, value) {
  set(blocksSrc, objPath, value)
  processBlocks()
  let tmpPath = path.resolve(os.tmpdir(), 'blocks-backup.json')
  console.log(`Saved tmp file to ${tmpPath}`)
  fs.writeFile(tmpPath, stringify(blocksSrc), () => {})
  if (!process.env.NOAUTOSAVE) {
    console.log('Autosaving blocks')
    save(objPath, value)
  }
  return true
}

function getBlockTypes () {
  let seen = {}
  let keys = Object.keys(blocksSrc).map(key => {
    return blocksSrc[key]._blockType
  }).filter(type => {
    let seenit = seen[type]
    seen[type] = true
    return !seenit
  })
  return keys.sort()
}
function getKeys (type, enabled) {
  let keys = Object.keys(blocksSrc)
  if (type) {
    keys = keys.filter(key => {
      if (enabled && blocksSrc[key]._disabled) {
        return false
      }
      return blocks[key]._blockType === type
    })
  }
  return keys
}
function getAll (type, value) {
  let keys = Object.keys(blocksSrc)
  if (type) {
    keys = keys.filter(key => {
      return blocksSrc[key][type] === value
    })
  }
  return keys
}

module.exports = {
  blocksSrc,
  blocks,
  get: getValue,
  set: setValue,
  getRaw: getRawValue,
  getAll,
  getKeys,
  getBlockTypes,
  save,
  destroy
}
