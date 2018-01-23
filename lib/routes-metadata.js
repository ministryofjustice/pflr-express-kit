'use strict'

const fs = require('fs')
const path = require('path')
const glob = require('glob')
const mkdirp = require('mkdirp')
const express = require('express')
const router = express.Router()

const { ENV } = require('./constants')

const logger = require('./logger')

// let get = require('lodash/get')
// let set = require('lodash/get')
const flattenDeep = require('lodash/flattenDeep')
// let Markdown = require('markdown').markdown.toHTML
const shortid = require('shortid')

const jsonschema = require('jsonschema')
const validator = new jsonschema.Validator()

const matchProp = require('./match-prop')
const getRouteHierarchy = require('./route-hierarchy')

const components = require('../app/components/components')
// load app instance components and  merge
// repeat for template
const flowchartController = require('../app/templates/flowchart/flowchart.controller')

const production = ENV === 'prod'
const development = !ENV

let flagsSrc = path.join(process.cwd(), 'metadata/flags.json')
let flags = {}

try {
  flags = require(flagsSrc)
} catch (e) {
  logger('No flags config found')
}

let cacheDir
let appDir
let kitDir
let schemas

let overrides = {}
let sessions = {}

let blockMethods = require('./get-block')
let {
  getBlock,
  getBlockProp,
  getBlockRaw,
  setBlock,
  getKeys,
  destroyBlock
} = blockMethods

let blocksDal = require('./blocks-dal')
let i18n = blocksDal.blocksSrc

blockMethods.setLocalisation(blocksDal)

let Formatted = require('./get-formatted')

let getFieldValues

function recurseBlocks (node) {
  let nestedBlocks = []
  if (!node) {
    return nestedBlocks
  }
  if (typeof node === 'string') {
    node = [node]
  }
  node.forEach(el => {
    let blocks = getBlockProp(el, 'blocks')
    if (blocks) {
      nestedBlocks.push(blocks)
      nestedBlocks.push(recurseBlocks(blocks))
    }
    let subblock = getBlockProp(el, 'subblock')
    if (subblock) {
      nestedBlocks.push(subblock)
      nestedBlocks.push(recurseBlocks(subblock))
    }
    let checkbox = getBlockProp(el, '_blockType').match(/CheckboxGroup|RadioGroup/)
    if (checkbox) {
      let options = getBlockProp(el, 'options')
      if (options) {
        nestedBlocks.push(options)
        nestedBlocks.push(recurseBlocks(options))
        // options.forEach(opt => {
        //   let optReveals = getBlockProp(opt, 'reveals')
        //   if (optReveals) {
        //     nested_blocks.push(optReveals)
        //     nested_blocks.push(recurseBlocks(optReveals))
        //   }
        // })
      }
    }
  })
  return nestedBlocks
}

const handleError = (res, err) => {
  res.status(500).send(err)
}

let getRouteUrl = () => {}
const globalMethods = (req, res, next) => {
  req.hasGlobalMethods = true
  // TODO: move to final render section? NOPE. But do extricate
  let nunjucksEnv = res.app.locals.settings.nunjucksEnv
  nunjucksEnv.addGlobal('req', req)
  nunjucksEnv.addGlobal('res', res)
  nunjucksEnv.addGlobal('getRouteUrl', getRouteUrl)
  let FormattedMethods = Formatted.setFormat({}, {})
  Object.keys(FormattedMethods).forEach(key => {
    nunjucksEnv.addGlobal(key, FormattedMethods[key])
  })
  nunjucksEnv.addGlobal('splitWord', word => {
    return word.replace(/_/g, '_<wbr>')
  })
  nunjucksEnv.addGlobal('spaceToPlus', word => {
    return word.replace(/ /g, '+')
  })
  next()
}
// router.use(globalMethods)
router.globalMethods = globalMethods

let routesFlattened = {}
if (development) {
  router.get('/admin/sessions', (req, res) => {
    req.session.admin = true
    delete sessions[req.sessionID]
    res.render('admin/sessions/sessions', { sessions: Object.keys(sessions) })
  })
  router.get('/admin/session/:sessionID', (req, res) => {
    let sessionID = req.params.sessionID
    if (req.query.delete) {
      delete sessions[sessionID]
      res.redirect('/admin/sessions')
      return
    }
    req.sessionStore.get(sessionID, (err, session) => {
      if (err) {
        handleError(res, err)
      }
      if (req.query.clone) {
        req.session.autofields = Object.assign({}, session.autofields)
        // res.redirect('/admin/session/'+sessionID)
        res.redirect('/admin/sessions')
        return
      }
      let clonedSession = req.headers.referer && req.headers.referer.match(/clone/)
      res.render('admin/session/session', {
        sessionID,
        autofields: session.autofields,
        autofieldsJSON: JSON.stringify(session.autofields, null, 2),
        cloned_session: clonedSession
      })
    })
  })
  router.get('/admin/flags', (req, res) => {
    res.render('admin/flags/flags', { flags })
  })
  router.get('/api/flag/:flag/:state', (req, res) => {
    const flag = req.params.flag
    const stateAction = req.params.state.toLowerCase()
    if (stateAction === 'delete') {
      delete flags[flag]
    } else {
      let state = stateAction !== 'off'
      flags[flag] = state
    }
    if (req.headers.referer && req.headers.referer.match(/\/admin\/flags/)) {
      res.redirect(req.headers.referer)
    } else {
      res.json(flags)
    }
  })
  router.get('/api/flags/save', (req, res) => {
    fs.writeFile(flagsSrc, JSON.stringify(flags, null, 2), writeFileErr => {
      if (writeFileErr) {
        throw new Error(writeFileErr)
      }
      res.redirect('/admin/flags')
    })
  })
  router.get('/admin/overrides', (req, res) => {
    res.render('admin/overrides/overrides', {
      overrides,
      json: JSON.stringify(overrides, null, 2),
      autofields: req.session.autofields
    })
  })
  router.get('/admin/autofields', (req, res) => {
    let autofields = Object.assign({}, req.session.autofields)
    Object.keys(autofields)
      .filter(key => key.startsWith('flag-'))
      .forEach(key => {
        delete autofields[key]
      })
    res.render('admin/autofields/autofields', {
      autofields,
      json: JSON.stringify(autofields, null, 2)
    })
  })
  router.get('/admin/autofields/reset', (req, res) => {
    req.session.autofields = {}
    const redirectUrl = req.headers.referer || '/'
    res.redirect(redirectUrl)
  })
  router.all('/admin/report', (req, res) => {
    let report = {}
    if (typeof req.body === 'object' && req.body.report) {
      report = JSON.parse(req.body.report)
    }
    res.render('admin/report/report', {
      report,
      json: JSON.stringify(report, null, 2)
    })
  })
  router.get('/admin/routes', (req, res) => {
    let routes = getKeys('Route', true)
    res.render('admin/routes/routes', { routes })
  })

  router.get('/admin/blocks/:blockType', (req, res) => {
    let keys = blocksDal.getKeys(req.params.blockType).sort()
    res.render('admin/blocks/blocks', {
      keys,
      _blockType: req.params.blockType
    })
  })
  router.get('/admin/blocks/:blockType/new', (req, res) => {
    const _blockType = req.params.blockType
    const blockJSON = {
      _blockType
    }
    res.render('admin/block/block', {
      _blockType,
      blockJSON: JSON.stringify(blockJSON, null, 2),
      new: true
    })
  })
  router.get('/admin/blocks', (req, res) => {
    let blockTypes = blocksDal.getBlockTypes().sort()
    res.render('admin/block-types/block-types', { blockTypes })
  })
  router.get('/admin/block/:block', (req, res) => {
    let block = getBlockRaw(req.params.block) || {}
    let blockJSON = block
    const schema = schemas[block._blockType]
    const schemaProperties = schema ? schema.properties : {}
    const schemaProps = Object.keys(schemaProperties).map(prop => prop)
    const requiredProps = {}
    if (schema && schema.required) {
      schema.required.forEach(function (prop) {
        requiredProps[prop] = true
      })
    }
    let stringProps = [].concat(schemaProps, Object.keys(block))
    // let type = block.type
    // if (type === 'string') {
    //   res.redirect(req.originalUrl.replace(/block/, 'string'))
    //   return
    // }
    // if (type === 'error') {
    //   res.redirect(req.originalUrl + '/value')
    //   return
    // }
    // let stringProps = Object.keys(block).filter(key => typeof block[key] === 'string')

    stringProps = stringProps.filter(key => {
      if (key === '_blockType') {
        return false
      }
      if (key === '_id') {
        return false
      }
      if (key.indexOf('x') === 0) {
        return false
      }
      return true
    }).filter((item, index, array) => {
      return array.indexOf(item) === index
    })
    // redirect single value props
    if (block._blockType === 'String' && stringProps.length === 1 && typeof block[stringProps[0]] !== 'object') {
      res.redirect(req.originalUrl + '/' + stringProps[0])
      return
    }
    if (!block._blockType && req.params.block.startsWith('string:')) {
      blockJSON = {
        _blockType: 'String',
        _id: req.params.block,
        value: ''
      }
    }
    res.render('admin/block/block', {
      block: req.params.block,
      blockJSON: JSON.stringify(blockJSON, null, 2),
      blockJSONExpanded: JSON.stringify(getBlock(req.params.block) || blockJSON, null, 2),
      parentBlock: routesFlattened[req.params.block].parent || null,
      stringProps,
      schemaProperties,
      requiredProps
    })
  })
  router.post('/admin/block/:block', (req, res) => {
    let redirectUrl = req.originalUrl
    let blockId = req.params.block
    let blockType = getBlockProp(blockId, '_blockType')
    let { block, action, cloneId, propName } = req.body
    logger({ blockId, action })
    if (action === 'delete') {
      return destroyBlock(blockId)
              .then(() => {
                registerRoutes()
                res.redirect(`/admin/blocks/${blockType}`)
              })
              .catch(err => res.send(err))
    }
    if (block) {
      if (typeof block === 'string') {
        try {
          block = JSON.parse(block)
        } catch (e) {
          res.status(500).send('Invalid JSON')
        }
      }
      if (propName && action === 'prop') {
        redirectUrl = `/admin/block/${blockId}/${propName}`
        // res.redirect(redirectUrl)
        // return
      } else if (cloneId && action === 'clone') {
        blockId = cloneId
        block._id = blockId
        redirectUrl = `/admin/block/${blockId}`
      }
      if (action.match(/(update|delete|clone)/)) {
        setBlock(blockId, block)
        registerRoutes()
      }
      // res.redirect(redirectUrl)
    } else {
      // res.redirect(redirectUrl)
    }
    res.redirect(redirectUrl)
  })
  const arrayProps = ['blocks', 'steps', 'options', 'items']
  router.get('/admin/block/:block/:prop', (req, res) => {
    let {block, prop} = req.params
    let rawBlock = getBlockRaw(req.params.block)
    const blockSchema = schemas[rawBlock._blockType]
    const schemaProps = rawBlock && blockSchema ? blockSchema.properties : {}
    const propSchema = schemaProps[prop] || {}
    let doesNotExist = rawBlock === undefined
    let isArrayProp = arrayProps.includes(prop)
    let propValue = rawBlock[prop]
    let propType = 'string'
    let noValue = propValue === undefined
    let multiline = propSchema.type ? propSchema.multiline : true
    if (propSchema.type) {
      propType = propSchema.type
    } else {
      if (isArrayProp) {
        propType = 'array'
      } else if (!noValue) {
        propType = typeof propValue
        if (propType === 'object' && Array.isArray(propValue)) {
          propType = 'array'
        }
      }
    }

    if (propType === 'array') {
      propValue = propValue || []
    }
    res.render(`admin/prop/prop`, {
      doesNotExist,
      block,
      prop,
      propType,
      propSchema,
      value: propValue,
      noValue,
      multiline
    })
  })
  router.post('/admin/block/:block/:prop', (req, res) => {
    let { block, prop } = req.params
    let { value, propType, action } = req.body
    let redirectUrl = req.originalUrl
    let rawBlock = getBlockRaw(block)
    const blockSchema = schemas[rawBlock._blockType]
    const schemaProps = rawBlock && blockSchema ? blockSchema.properties : {}
    const propSchema = schemaProps[prop] || {}

    if (value !== undefined && rawBlock) {
      if (action === 'delete') {
        value = undefined
        propType = undefined
      }
      if (action === 'delete') {
        value = undefined
        propType = undefined
      }
      if (propType === 'array') {
        if (typeof value === 'string') {
          value = [value]
        }
        if (propSchema.items && propSchema.items.type === 'object') {
          value = value.map(item => item ? JSON.parse(item) : '')
        }
        value = value.filter(item => item !== '')
        if (value.length === 0) {
          value = undefined
        }
      } else if (propType === 'object') {
        value = value ? JSON.parse(value) : {}
      } else if (propType === 'boolean') {
        if (value === 'true') {
          value = true
        } else if (value === 'false') {
          value = false
        } else {
          value = undefined
        }
      } else if (propType === 'number') {
        value = value * 1
        if (isNaN(value)) {
          value = undefined
        }
      }
      if (value === undefined) {
        delete rawBlock[prop]
        redirectUrl = redirectUrl.replace(/\/[^/]+$/, '')
      } else {
        rawBlock[prop] = value
      }
      setBlock(block, rawBlock)
      registerRoutes()
      res.redirect(redirectUrl)
      // blocksDal.save().then(() => {
      //   res.redirect(req.originalUrl)
      // })
    } else {
      res.redirect(req.originalUrl)
    }
  })
  // router.get('/admin/string/:block', (req, res) => {
  //   res.render('admin/string/string', {
  //     type: 'string',
  //     block: req.params.block,
  //     value: getBlockProp(req.params.block, 'value') || ''
  //   })
  // })
  // router.post('/admin/string/:block', (req, res) => {
  //   if (req.body && req.body.value !== undefined) {
  //     let block = {
  //       type: 'string',
  //       value: req.body.value
  //     }
  //     setBlock(req.params.block, block)
  //     res.redirect(req.originalUrl)
  //     // blocksDal.save().then(() => {
  //     //   res.redirect(req.originalUrl)
  //     // })
  //   } else {
  //     res.redirect(req.originalUrl)
  //   }
  // })
  router.post('/api/overrides', (req, res) => {
    let resObj = {
      action: req.originalUrl,
      payload: req.body
    }
    if (typeof req.body === 'object') {
      overrides = req.body
      res.json(resObj)
      return
    }
    resObj.error = true
    res.status(500).json(resObj)
  })
  router.post('/api/autofields', (req, res) => {
    let resObj = {
      action: req.originalUrl,
      payload: req.body
    }
    if (typeof req.body === 'object') {
      req.session.autofields = req.body
      res.json(resObj)
      return
    }
    resObj.error = true
    res.status(500).json(resObj)
  })
  router.post('/api/autofield', (req, res) => {
    let resObj = {
      action: req.originalUrl,
      payload: req.body
    }
    if (typeof req.body === 'object') {
      req.session.autofields = req.session.autofields || {}
      Object.keys(req.body).forEach(key => {
        req.session.autofields[key] = req.body[key]
      })
      res.json(resObj)
      return
    }
    resObj.error = true
    res.status(500).json(resObj)
  })
  router.get('/admin/manage/:route', (req, res) => {
    let route = Object.assign({}, getBlock(req.params.route))
    let blocks
    if (route.blocks) {
      blocks = route.blocks.map(r => {
        let rLabel = getBlockProp(r, ['heading', 'label'])
        rLabel = r + (rLabel ? ' - ' + rLabel : '')
        return {
          name: `skip:${r}`,
          label: rLabel,
          value: 'yes'
        }
      })
    }
    res.render('admin/toggle/toggle', { blocks: blocks })
  })

  router.get('/api/block/:blockType/:value', (req, res) => {
    res.json(blocksDal.getAll(req.params.blockType, req.params.value) || [])
  })
  router.get('/api/block/:block', (req, res) => {
    res.json(getBlockRaw(req.params.block) || {})
  })
  router.post('/api/block/:block', (req, res) => {
    let resObj = {
      action: req.originalUrl,
      payload: req.body
    }
    if (typeof req.body === 'object') {
      let result = setBlock(req.params.block, req.body)
      if (result) {
        resObj.success = true
        res.json(resObj)
        return
      }
    }
    resObj.error = true
    res.status(500).json(resObj)
  })

  router.post('/api/blocks/save', (req, res) => {
    blocksDal.save().then(els => {
      if (req.headers.referer.match(/\/admin\//)) {
        res.redirect(req.headers.referer)
      } else {
        res.json(els)
      }
    }).catch(e => {
      res.json({
        error: e,
        wuh: 'huh?'
      })
    })
  })
}

function registerRoutes () {
  router.stack = router.stack.filter(r => r.name !== 'routeHandler')
  let rootUrl = '/'

  const kitDirSchemaPath = path.join(kitDir, 'app', 'components') + '/**/*.schema.json'
  const appDirSchemaPath = path.join(appDir, 'app', 'components') + '/**/*.schema.json'
  const schemaPaths = [].concat(glob.sync(kitDirSchemaPath), glob.sync(appDirSchemaPath))
  schemas = {}
  schemaPaths.forEach(schemaPath => {
    const schema = require(schemaPath)
    schemas[schema.title] = schema
  })

  // let storeValues = function () {
  //   return (req, res) => {
  //     let controller = new Promise(function (resolve) {})
  //   }
  // }
  let getDefaultController = (req, res) => {
    return () => Promise.resolve()
  }
  // let routesConfig = require('./metadata/routes.json')
  let routes = getKeys('Route', true) || [] // routesConfig.routes
  routes = routes.filter(route => getBlockProp(route, '_isa') !== 'view:form')

  // let blockRouteMapping = {}
  function getParentNextStep (routeName) {
    let route = routesFlattened[routeName]
    let parent = routesFlattened[route.parent]
    if (parent && parent.steps) {
      let parentSteps = parent.steps
      let parentPos = parentSteps.indexOf(routeName)
      if (parentSteps[parentPos + 1]) {
        return parentSteps[parentPos + 1]
      } else {
        return getParentNextStep(route.parent)
      }
    }
  }

  function flattenRoutes (routes, urlPrefix, hierarchy) {
    // hierarchy = hierarchy || []
    urlPrefix = urlPrefix.replace(/\/+$/, '')
    routes.forEach((routeName, index) => {
      let routeHierarchy = hierarchy ? hierarchy.slice() : []
      if (!routesFlattened[routeName]) {
        routesFlattened[routeName] = Object.assign({}, getBlock(routeName))
        // let routeExtends = routesFlattened[routeName].isa
        // if (routeExtends) {
        //   routesFlattened[routeName] = Object.assign({}, pages[routeExtends], routesFlattened[routeName])
        //   i18n['route.' + routeName] = Object.assign({}, i18n['route.' + routeExtends], i18n['route.' + routeName])
        // }
      }
      let route = routesFlattened[routeName]
      route.hierarchy = routeHierarchy.slice()
      route.hierarchy.push(routeName)
      route.wizard = route.hierarchy[0]
      // route.selected_hierarchy = route.hierarchy.slice(1)
      if (routeHierarchy.length) {
        route.parent = routeHierarchy[routeHierarchy.length - 1]
      }
      if (route.parent) {
        let nextStep = getParentNextStep(routeName)
        route.nextStep = nextStep
      }
      routeHierarchy.push(routeName)
      route.url = route.url || routeName
      if (route.url.indexOf('/') !== 0) {
        route.url = urlPrefix + '/' + route.url
      }
      if (route.steps) {
        // console.log(routeName, 'has steps - depends=', !!route.depends)
        // console.log('REDIRECT TOP', routeName, route.steps[0])
        routesFlattened[routeName].redirect = route.steps[0]
        route.steps.forEach((step, i) => {
          routesFlattened[step] = Object.assign({}, routesFlattened[step], getBlock(step))
          if (route.depends && !routesFlattened[step].depends) {
            routesFlattened[step].depends = route.depends
            // console.log(step, 'depends')
          }
          if (route.steps[i + 1]) {
            // console.log('REDIRECT STEP', step, route.steps[i + 1])
            routesFlattened[step].redirect = route.steps[i + 1]
          } else if (routes[index + 1] && hierarchy) {
            // console.log('MISSED STEP', step, routes[index + 1])
            routesFlattened[step].redirect = routes[index + 1]
          }
          if (i === 0) {
            routesFlattened[step].firstStep = true
          }
          if (i === route.steps.length - 1) {
            routesFlattened[step].lastStep = true
          }
        })
        let routeUrlPrefix = route.url
        if (routeUrlPrefix.indexOf('/') !== 0) {
          routeUrlPrefix = urlPrefix + '/' + routeUrlPrefix
        }
        flattenRoutes(route.steps, routeUrlPrefix, routeHierarchy)
      }
    })
  }
  flattenRoutes(routes, rootUrl)
  // flattenRoutes(['route:index'], rootUrl)

  let addPageEntry = function (routeName, entry) {
    let route = routesFlattened[routeName]

    entry.route = routeName
    entry.url = route.url
    entry.heading = route.heading

    if (route.steps) {
      entry.steps = []
      route.steps.forEach((stepName, idx) => {
        entry.steps[idx] = addPageEntry(stepName, {})
      })
    }

    return entry
  }

  router.get('/admin/pages', (req, res) => {
    let routes = getKeys('Route', true)
    let allPages = []

    // start pushing pages at index and work down through the hierarchy
    allPages.push(addPageEntry('route:index', {}))

    res.render('admin/pages/pages', {
      'routes': routes,
      'allPages': allPages
    })
  })

  getRouteUrl = function (name, params, options = {}) {
    let url = options.exact ? undefined : '/dev/null'
    if (routesFlattened[name]) {
      url = routesFlattened[name].url
    }
    if (options.edit) {
      url += '/change'
    }
    return url
  }

  let wizardHierarchy = getRouteHierarchy(routes, routesFlattened)
  // console.log('wizardHierarchy', JSON.stringify(wizardHierarchy, null, 2))

  let routeUrls = {}
  let urlUrls = []
  getKeys('Url').forEach(url => {
    urlUrls[url] = getBlockProp(url, 'value')
  })
  // let blah = Object.keys(routesFlattened).sort(function(a, b){
  //   return getRouteUrl(a).localeCompare(getRouteUrl(b))
  // }).reverse()
  // console.log(blah)
  Object.keys(routesFlattened).sort((a, b) => {
    return getRouteUrl(a).localeCompare(getRouteUrl(b))
  }).reverse().forEach(routeName => {
    let route = routesFlattened[routeName]

    logger('Serving', routeName, '=>', route.url)
    route.id = routeName
    // if (!route.id.match(/route:/)) {
    //   route.id = 'route:' + route.id
    // }
    // route.key = routeName.replace(/^route:/, '')

    let method = route.method || 'use'
    let url = route.url
    routeUrls[routeName] = url
    // let routeController = route.controller ? require('./controllers/' + route.controller) : getDefaultController
    let routeController = route.controller ? require(path.join(appDir, route.controller)) : getDefaultController

    let routeHandler = (req, res, next) => {
      const originalUrl = req.originalUrl.replace(/\?.*/, '')
      if (url !== originalUrl) {
        const testUrl = originalUrl.replace(/\/(edit|flowchart|change)$/, '') || '/'
        if (url !== testUrl) {
          next()
          return
        }
      }

      getFieldValues = () => {
        if (!req.session.autofields) {
          req.session.autofields = {}
        }
        return req.session.autofields
      }
      function getFieldValue (name) {
        let values = (route.overrides || getBlockProp(name, 'override')) ? overrides : getFieldValues()
        let value = values[name]
        if (value === undefined) {
          // value = getBlockProp(name, 'default')
        }
        return value
      }
      const getValue = (name, defaultValue) => {
        let value = getFieldValue(name)
        return value !== undefined ? value : defaultValue
        // if (!vals) {
        //   vals = values
        // }
        // return values[name]
      }
      const getMultipleValues = (multipleCounter, prefix) => {
        const multipleValues = []
        const multipleCounterValue = getValue(multipleCounter, 0)
        for (let index = 0; index < multipleCounterValue; index++) {
          multipleValues.push(getValue(`${prefix}${index + 1}`))
        }
        return multipleValues
      }
      function setFieldValue (name, value) {
        let values = (route.overrides || getBlockProp(name, 'override')) ? overrides : getFieldValues()
        values[name] = value
        return values[name]
      }
      getFieldValues()

      let sessionID = req.sessionID
      if (!req.session.admin) {
        sessions[sessionID] = true
      } else {
        delete sessions[sessionID]
      }

      let isFlowchart = !!req.path.match(/\/flowchart$/)
      let isEdit = isFlowchart || !!req.path.match(/\/edit$/)
      let isChange = !!req.originalUrl.match(/\/change$/)

      let routeInstanceController = isFlowchart ? flowchartController : routeController
      let routeHandler = routeInstanceController(req, res, {wizardHierarchy})
      // Call controller if exists
      logger('use routeName', routeName)
      if (!req.session.access_code) {
        req.session.access_code = shortid.generate()
      }
      // if (req.url !== '/') {
      //   let possibleCode = req.url.replace(/^\//, '')
      //   if (possibleCode !== 'change') {
      //     req.session.access_code = possibleCode
      //   }
      // }
      const getFlattenedBlocks = route => {
        const blocks = (route.blocks || []).slice()
        // let blocksToValidate = blocks.slice()
        return flattenDeep(blocks.concat(recurseBlocks(blocks)))
      }
      let accessCode = req.session.access_code.substr(0, 10)
      // let blocks = (route.blocks || []).slice()
      // let blocksToValidate = blocks.slice()
      let blocksFound = getFlattenedBlocks(route)
      // console.log({blocksFound})

      let blockTriggers = {}
      let protectedBlocks = {}
      blocksFound.forEach(el => {
        let deps = getBlockProp(el, 'depends')
        if (deps) {
          // console.log(el, deps)
          deps.forEach(dep => {
            Object.keys(dep).forEach(inkey => {
              let key = inkey
              let negated
              if (key.indexOf('!') === 0) {
                negated = true
                key = key.substr(1)
              }
              let matchRegex = new RegExp('^' + key + '$')
              let matchedKeys = blocksFound.filter(el => {
                return el.match(matchRegex)
              })
              if (!matchedKeys.length) {
                if (blocksFound.includes(key)) {
                  matchedKeys.push(key)
                }
              }
              if (matchedKeys.length) {
                protectedBlocks[el] = true
                if (route._prefix) {
                  protectedBlocks[route._prefix + el] = true
                }
              }
              matchedKeys.forEach(match => {
                blockTriggers[match] = blockTriggers[match] || []
                blockTriggers[match].push({
                  reveals: el,
                  match: new RegExp('^' + dep[inkey] + '$'),
                  yematch: '^' + dep[inkey] + '$',
                  negated: negated
                })
                if (route._prefix) {
                  const prefixedMatch = route._prefix + match
                  blockTriggers[prefixedMatch] = blockTriggers[prefixedMatch] || []
                  blockTriggers[prefixedMatch].push({
                    reveals: route._prefix + el,
                    match: new RegExp('^' + dep[inkey] + '$'),
                    yematch: '^' + dep[inkey] + '$',
                    negated: negated
                  })
                }
              })
              // console.log('key', key)
              // console.log('matchedKeys', matchedKeys)
            })
          })
          // console.log(el, 'deps', JSON.stringify(deps, null, 2))
        }
      })
      // console.log('blocksFound', blocksFound)
      // console.log('protectedBlocks', protectedBlocks)
      // console.log('blockTriggers', blockTriggers)

      let checkNoDependency = (name, skip, explicitDependency, prefix) => {
        // if (name.match(/foo/)) {
        //   console.log(name, 'DEPENDS', name)
        // }
        let dependencyMet = true
        if (skip && protectedBlocks[name]) {
          return dependencyMet
        }
        let displayOverride = getFieldValue('override--' + name)
        if (displayOverride === 'show') {
          return true
        } else if (displayOverride === 'hide') {
          return false
        }
        let depends = explicitDependency || getBlockProp(name, 'depends')
        if (depends && prefix && route._prefix) {
          depends = depends.slice()
          depends = depends.map(dep => {
            const newDep = Object.assign({}, dep)
            const keys = Object.keys(newDep)
            keys.forEach(key => {
              newDep[`${route._prefix}${key}`] = newDep[key]
              delete newDep[key]
            })
            return newDep
          })
        } else if (depends && route._prefix) {
          depends = depends.slice()
          depends = depends.map(dep => {
            const newDep = Object.assign({}, dep)
            const keys = Object.keys(newDep)
            keys.forEach(key => {
              const newKey = key
                              .replace(/\[route._prefix\]/, route._prefix)
                              .replace(/\[route._index\]/, route._index)
                              .replace(/\[route.dynamicIndex\]/, route.dynamicIndex)
              newDep[newKey] = newDep[key]
              if (newKey !== key) {
                delete newDep[key]
              }
            })
            return newDep
          })
        }
        if (depends) {
          depends = depends.slice()
          if (route._prefix) {
            let multipleCounterRef = getBlockProp(name, 'multiple_counter_ref')
            if (multipleCounterRef) {
              depends = depends.map(dep => {
                const newDep = Object.assign({}, dep)
                const keys = Object.keys(newDep)
                keys.forEach(key => {
                  if (key === multipleCounterRef) {
                    newDep[`${route._prefix}${key}`] = newDep[key]
                    delete newDep[key]
                  }
                })
                return newDep
              })
            }
          }
          // if (name.match(/foo/)) {
          //   console.log(name, 'DEPENDS', JSON.stringify(depends, null, 2))
          //   console.log('depends route', JSON.stringify(route, null, 2))
          //   console.log('autofields', autofields)
          // }
          // dependencyMet = matchProp(autofields, depends)
          let testValues = Object.assign({}, getFieldValues(), req.body)
          Object.keys(flags).forEach(key => {
            testValues[`flag-${key}`] = flags[key]
          })
          testValues['route:dynamicIndex'] = route.dynamicIndex
          testValues['route:_prefix'] = route._prefix
          testValues['route:_index'] = route._index
          dependencyMet = matchProp(testValues, depends)
        }
        return dependencyMet
      }
      function checkRevealRequired (name) {
        return !!protectedBlocks[name]
      }

      function checkReveals (name, value) {
        let passed
        let checks = blockTriggers[name]
        if (checks) {
          // console.log(name, 'checks', JSON.stringify(checks, null, 2))
          for (let i = 0, clength = checks.length; i < clength; i++) {
            // check that value is coerced to string
            let match = value.match(checks[i].match)
            // console.log('yematch', checks[i].yematch, checks[i].match)
            // console.log('initial match', match)
            if (checks[i].negated) {
              match = !match
              // console.log('negated match', match)
            }
            if (match) {
              passed = checks[i].reveals
              break
            }
          }
        }
        return passed
      }
      let routeInstance = Object.assign({}, route, {})
      let errors
      let noRedirect
      let noValidation
      if (req.method === 'POST') {
        Object.keys(req.body)
          .filter(key => key.match(/^(add|delete)$/))
          .forEach(key => {
            // const actionKey = key.replace(/^(add|delete):/, '')
            const actionKey = req.body[key]
            delete req.body[key]
            const currentActionValue = getFieldValue(actionKey) || 1
            let actionValue = (currentActionValue) * 1
            // delete req.body[actionKey]
            if (key === 'add') {
              actionValue++
              if (actionValue > route.multiple_max) {
                noRedirect = true
                noValidation = true
                return
              }
              // Pathetic - but because the back journey is recorded rather than determined from the real wizard flow
              const journey = req.session.journey
              if (journey[journey.length - 1] === routeInstance._id) {
                journey.pop()
                req.session.journey = journey
              }
              routeInstance.redirect = routeInstance.multiple_start ? routeInstance.multiple_start : `${routeInstance.multiple_url}/${actionValue}`
            }
            if (key === 'delete') {
              actionValue--
              noRedirect = true
              noValidation = true
              if (actionValue < route.multiple_min) {
                return
              }
            }
            req.body[actionKey] = actionValue
            setFieldValue(actionKey, actionValue)
          })
        Object.keys(req.body)
          .filter(key => key.match(/^(add|delete):/))
          .forEach(key => {
            const actionKey = key.replace(/^(add|delete):/, '')
            let actionValue = req.body[actionKey] * 1
            delete req.body[key]
            if (key.startsWith('add')) {
              actionValue++
            }
            if (key.startsWith('delete')) {
              actionValue--
            }
            req.body[actionKey] = actionValue
            setFieldValue(actionKey, actionValue)
            noRedirect = true
            noValidation = true
          })
        errors = {}
        const inboundValues = Object.assign({}, getFieldValues(), req.body)
        blocksFound.forEach(el => {
          const block = getBlock(el)
          if (block.multiple_counter) {
            const multipleCounter = `${route._prefix || ''}${block.multiple_counter}`
            if (getFieldValue(multipleCounter) === undefined) {
              req.body[multipleCounter] = block.multiple_min
              setFieldValue(multipleCounter, block.multiple_min)
            }
          }
          if (noValidation) {
            return
          }
          if (block.multiple_counter_ref) {
            if (!checkNoDependency(el)) {
              return
            }
          }
          const prefixedEl = `${route._prefix || ''}${el}`
          let inboundValue = req.body[prefixedEl]
          let schema = Object.assign({}, block)
          schema.type = schema._blockType.toLowerCase() || 'string'
          if (schema.type === 'password') {
            schema.type = 'text'
          }
          if (schema.type.match(/number|integer/)) {
            inboundValue = inboundValue ? Number(inboundValue) : undefined
          } else if (schema.type === 'radiogroup') {
            schema.type = 'string'
            let optionsEnum = schema.options.map(option => {
              return getBlockProp(option, 'value')
            })
            schema.enum = optionsEnum
          }
          if (schema.type === 'text') {
            if (!inboundValue || (inboundValue.match && inboundValue.match(/^\s*$/))) {
              inboundValue = undefined
            }
          }
          if (schema.depends && schema.required) {
            schema.requiredWhen = schema.depends.slice()
            delete schema.required
          }
          if (schema.requiredWhen) {
            const unsureKey = prefixedEl + '_unsure'
            if (req.body[unsureKey] === undefined && inboundValues[unsureKey] !== undefined) {
              delete inboundValues[unsureKey]
            }
            let requiredWhen = schema.requiredWhen.slice()
            requiredWhen = requiredWhen.map(dep => {
              const newDep = Object.assign({}, dep)
              const keys = Object.keys(newDep)
              keys.forEach(key => {
                const keys = key.split('[multiple_route]')
                if (keys.length > 1) {
                  const newKey = keys[0] + route._prefix + keys[1]
                  newDep[newKey] = newDep[key]
                  delete newDep[key]
                }
              })
              return newDep
            })
            const isRequired = matchProp(inboundValues, requiredWhen)
            if (isRequired) {
              schema.required = true
            }
          }

          // this is a bug if requiredWhen is in effect?
          if ((schema.required || schema.requiredWhen) && schema._blockType === 'CheckboxGroup') {
            if (checkNoDependency(el)) {
              let optionChecked
              if (schema.options) {
                schema.options.forEach(opt => {
                  if (route._prefix) {
                    opt = `${route._prefix}${opt}`
                  }
                  if (req.body[opt] === undefined && inboundValues[opt] !== undefined) {
                    delete inboundValues[opt]
                  }
                  if (inboundValues[opt]) {
                    optionChecked = true
                  }
                })
              }
              if (optionChecked) {
                delete schema.required
              }
            } else {
              delete schema.required
            }
          }
          // console.log(el, 'checkNoDependency', checkNoDependency(el))
          let validationError
          const componentBlock = components[schema._blockType] || {}
          if (componentBlock && componentBlock.validate) {
            const validateComponent = componentBlock.validate
            const setComponentValue = componentBlock.setValue
            const componentValues = {}
            Object.keys(req.body)
              .filter(key => key.startsWith(prefixedEl))
              .map(key => key.replace(new RegExp('^' + prefixedEl + '.'), ''))
              .forEach(key => {
                componentValues[key] = req.body[prefixedEl + '.' + key]
              })
            validationError = validateComponent(componentValues, schema, prefixedEl)
            if (!validationError[0] && setComponentValue) {
              req.session.autofields[prefixedEl] = setComponentValue(prefixedEl, componentValues)
            }
          } else {
            validationError = validator.validate(inboundValue, schema).errors
          }

          if (validationError.length) {
            const elError = validationError[0]
            if (schema._blockType === 'CheckboxGroup' && schema.options.length > 1) {
              elError.name = 'requiredCheckboxGroup'
            }
            if (schema._blockType === 'RadioGroup' && schema.options.length > 0) {
              elError.name = 'requiredRadioGroup'
            }
            errors[prefixedEl] = elError
            if (elError.composite) {
              Object.keys(elError.composite)
                .forEach(key => {
                  errors[prefixedEl + '.' + key] = Object.assign({ noheader: true }, elError.composite[key])
                })
            }
          }
        })
        if (flags.no_validation) {
          errors = []
        }
        if (!Object.keys(errors).length) {
          errors = undefined
        }
        if (req.body) {
          blocksFound.forEach(el => {
            setFieldValue(el, req.body[el])
          })
          Object.keys(req.body).filter(el => blocksFound.indexOf(el) === -1).forEach(el => {
            if (el !== 'updateForm') {
              setFieldValue(el, req.body[el])
            }
          })
        }
        const routeCounter = route.multiple_counter
        if (routeCounter && req.body[routeCounter]) {
          setFieldValue(routeCounter, (req.body[routeCounter] || 0) * 1)
        }
        // console.log('SESSION', JSON.stringify(req.session, null, 2))
      }
      // console.log('referer', req.referer, req.get('referrer'))
      // console.log('blocks_found', blocks_found)
      let values = {}
      blocksFound.forEach(el => {
        values[el] = getFieldValue(el)
      })
      // console.log('values', values)
      let autofields = getFieldValues()
      // if (route.overrides) {
      //   autofields = Object.assign({}, autofields, overrides)
      // }
      routeInstance = Object.assign({}, routeInstance, {
        values,
        autofields,
        overrides,
        errors,
        blocks_base: route.blocks,
        blocks_found: blocksFound
      })
      // let checkNoDependency = (name, skip, explicitDependency) => {
      //   let dependencyMet = true
      //   if (skip && protectedBlocks[name]) {
      //     return dependencyMet
      //   }
      //   let displayOverride = getFieldValue('override--' + name)
      //   if (displayOverride === 'show') {
      //     return true
      //   } else if (displayOverride === 'hide') {
      //     return false
      //   }
      //   let depends = explicitDependency || getBlockProp(name, 'depends')
      //   if (depends) {
      //     // console.log('DEPENDS', JSON.stringify(depends, null, 2))
      //     // console.log('autofields', autofields)
      //     // dependencyMet = matchProp(autofields, depends)
      //     dependencyMet = matchProp(getFieldValues(), depends)
      //   }
      //   return dependencyMet
      // }
      // function checkRevealRequired (name) {
      //   return !!protectedBlocks[name]
      // }
      if (isFlowchart || isEdit || req.query.showall) {
        checkNoDependency = () => true
      }
      let businessBlocks = routeInstance.blocks || []
      if (businessBlocks || routeInstance._isa === 'view:form') {
        if (!checkNoDependency(routeInstance.id, false, routeInstance.depends)) {
          businessBlocks = []
          routeInstance.skipRoute = true
          routeInstance.redirect = routeInstance.nextStep
          // routeInstanceFinal.nextStep
          // and if it has steps, skip those too
        }
        // console.log({businessBlocks})
        businessBlocks = businessBlocks.filter(el => {
          return !getBlockProp(el, 'auxilliary') && checkNoDependency(el, true)
        })
        routeInstance.blocks = businessBlocks
      }
      routeInstance.wizardHierarchy = wizardHierarchy
      routeInstance.homepage = 'route:index'
      routeHandler(routeInstance, Object.assign(
        {},
        blockMethods,
        {
          getRouteUrl,
          checkNoDependency,
          getValue,
          getMultipleValues,
          setFieldValue
        }
      ))
        .then(routeOutcome => {
          let routeInstanceFinal = Object.assign({}, routeInstance, routeOutcome)
          if (routeInstanceFinal.errors) {
            errors = routeInstanceFinal.errors
          }
          const saveReturn = !!req.body['save-return']
          if (saveReturn) {
            errors = undefined
          }

          let wizard = routeInstanceFinal.wizard
          let autofields = routeInstanceFinal.autofields
          if ((wizard && routesFlattened[wizard].useOverrides) || routeInstanceFinal.useOverrides) {
            autofields = Object.assign({}, autofields, overrides)
          }
          req.session.visited = req.session.visited || {}
          let wizardlastRoute
          // sigh
          if (wizard && (wizardHierarchy[wizard] || wizardHierarchy['route:index'])) {
            wizardlastRoute = (wizardHierarchy[wizard] || wizardHierarchy['route:index']).lastRoute
          }
          if (wizardlastRoute === routeName) {
            routeInstanceFinal.wizardlastRoute = true
            req.session.visited[wizardlastRoute] = true
          }
          if (routeInstanceFinal.redirectConditions) {
            let conditionalRedirect
            const conditionalRoutes = routeInstanceFinal.redirectConditions
            Object.keys(conditionalRoutes).forEach(conditionalRoute => {
              if (!conditionalRedirect) {
                const matchedConditionalRoute = matchProp(autofields, conditionalRoutes[conditionalRoute])
                if (matchedConditionalRoute) {
                  conditionalRedirect = conditionalRoute
                }
              }
            })
            if (conditionalRedirect) {
              routeInstanceFinal.redirect = conditionalRedirect
            }
          }
          // klunky, klunky, klunky
          if (req.method === 'POST') {
            routeInstanceFinal.redirect = routeInstanceFinal.redirect || routeInstanceFinal.nextStep
          }
          let redirectUrl = routeUrls[routeInstanceFinal.redirect] || routeInstanceFinal.redirect || getRouteUrl(routeInstanceFinal.nextStep)
          if (!isFlowchart && !noRedirect && !errors && req.method === 'POST' && routeInstanceFinal.redirect && req.originalUrl !== routeInstanceFinal.redirect && req.body.updateForm !== 'yes') {
            if (saveReturn) {
              logger('redirector save-return')
              res.redirect(getRouteUrl('route:save-return'))
              return
            }
            // console.log('REDIRECTOR A')
            req.session.visited[routeName] = true
            logger('redirector A', routeName, redirectUrl)
            if (isChange) {
              logger('change', routeName, isChange, {wizardlastRoute})

              if (wizardlastRoute) {
                const journey = req.session.journey
                let redirectRoute = journey[journey.length - 1] // wizardlastRoute
                logger({redirectRoute})
                if (getBlockProp(redirectRoute, 'template') !== 'summary') {
                  let newRedirectRoute = getBlockProp(redirectRoute, 'redirect') || routeInstanceFinal.nextStep
                  if (newRedirectRoute) {
                    redirectRoute = newRedirectRoute
                  }
                }
                logger('finally', {redirectRoute})
                redirectUrl = getRouteUrl(redirectRoute)
              }
              // redirectUrl = req.get('referrer')
            }
            res.redirect(redirectUrl)
          } else {
            if (routeInstance.skipRoute || (req.method === 'POST' && routeInstance.noblocks) || (route.blocks && (!routeInstanceFinal.blocks || !routeInstanceFinal.blocks.length))) {
              // console.log('REDIRECTOR B')
              logger(req.originalUrl, 'REDIRECT TO', redirectUrl, routeInstanceFinal.nextStep)
              res.redirect(redirectUrl)
              return
            }
            // Work out number of wizard steps, the number of the step and the wizard flow data (for flowchart generation)
            // console.log('routeInstanceFinal.wizard', routeInstanceFinal.wizard, wizardHierarchy)
            // routeInstanceFinal.wizard = 'route:children_instructions'
            let routeWizard = wizardHierarchy[routeInstanceFinal.wizard]
            if (routeWizard && routeWizard.slice && routeInstanceFinal.template === 'step-by-step') {
              let stepsFlat = routeWizard.stepsFlat.slice()
              let lastRoute = routeWizard.lastRoute
              routeWizard = routeWizard.slice()
              routeWizard.unshift({
                route: routeInstanceFinal.wizard
              })
              stepsFlat.unshift(routeInstanceFinal.wizard)
              routeWizard = routeWizard.filter(step => {
                return overrides['override--action-section--' + step.route.replace(/^route:/, '')] !== 'hide'
              })
              stepsFlat = stepsFlat.filter(route => {
                return !overrides['override--action-section--' + route.replace(/^route:/, '')] !== 'hide'
              })
              routeWizard.stepsFlat = stepsFlat
              routeWizard.lastRoute = lastRoute
            }
            // console.log('req.session.id', JSON.stringify(req.session.id, null, 2))
            // console.log('req.sessionID', JSON.stringify(req.sessionID, null, 2))
            // console.log('req.sessionStore', req.sessionStore)
            // req.sessionStore.get(req.sessionID, function(sesh){
            // console.log('req.sessionID', req.sessionID, sesh)
            // })
            let wizardStepCount
            let wizardStepsLength
            let wizardSectionCount
            let wizardSectionCurrent
            let wizardSectionLength
            if (routeWizard) {
              let theWiz = routeWizard.stepsFlat.slice()
              // let wizExpose = theWiz.map(step => {
              //   return Object.assign({ name: step }, getBlock(step))
              // })
              // console.log('wizExpose', JSON.stringify(wizExpose, null, 2))
              if (routeInstanceFinal.template !== 'step-by-step') {
                theWiz.pop()
              }
              // console.log(theWiz)
              theWiz = theWiz.filter(step => {
                return routesFlattened[step] && routesFlattened[step].blocks
              })
              wizardStepsLength = theWiz.length
              wizardStepCount = theWiz.indexOf(routeName)
              if (routeInstanceFinal.hierarchy) {
                let wizHier = routeWizard.slice().map(step => {
                  return step.route
                })
                wizHier.pop()
                wizardSectionLength = wizHier.length
                wizardSectionCurrent = routeInstanceFinal.hierarchy[1]
                wizardSectionCount = wizHier.indexOf(wizardSectionCurrent)
                if (wizardSectionCount > -1) {
                  wizardSectionCount++
                } else {
                  wizardSectionCount = 0
                }
              }
              if (wizardStepCount > -1) {
                wizardStepCount++
              } else {
                wizardStepCount = 0
              }
            }

            if (isEdit || isFlowchart) {
              routeInstanceFinal._index = '{n}'
            }

            let backRouteId
            let backRouteUrl
            if (routeInstanceFinal._form) {
              let journey = req.session.journey || []
              if (isChange) {
                backRouteId = journey[journey.length - 1]
              } else if (!isEdit && !isFlowchart) {
                const routeId = routeInstanceFinal._id
                const journeyPosition = journey.indexOf(routeId)
                if (journeyPosition > -1) {
                  journey.length = journeyPosition + 1
                } else {
                  journey.push(routeId)
                }
                if (journey[0] !== 'route:index') {
                  journey = []
                }
                req.session.journey = journey
                backRouteId = journey[journey.length - 2]
              }
              if (backRouteId && routeInstanceFinal.template !== 'summary') {
                backRouteUrl = getRouteUrl(backRouteId, {}, { exact: true })
              }
            }

            const journey = req.session.journey
            const lastRouteId = journey ? journey[journey.length - 1] : ''
            let lastRouteUrl = ''
            if (lastRouteId) {
              lastRouteUrl = getRouteUrl(lastRouteId)
            }
            if (routeInstanceFinal._id === 'route:saved') {
              req.session.saved = true
            }
            let saveContinue = false
            if (routeInstanceFinal._form && !req.session.saved) {
              saveContinue = true
            }

            let appData = {
              ENV,
              production,
              back: {
                id: backRouteId,
                url: backRouteUrl
              },
              last: {
                id: lastRouteId,
                url: lastRouteUrl
              },
              saveContinue,
              urls: Object.assign({}, urlUrls, routeUrls),
              autofields,
              wizards: wizardHierarchy,
              route: routeInstanceFinal,
              accessCode
            }
            appData.errors = {
              length: (errors ? Object.keys(errors).length : 0)
            }
            // if (wizardStepCount) {
            appData.wizard = {
              steps: {
                length: wizardStepsLength,
                count: wizardStepCount,
                last: wizardStepCount === wizardStepsLength,
                remaining: wizardStepsLength + 1 - wizardStepCount
              },
              sections: {
                length: wizardSectionLength,
                count: wizardSectionCount,
                current: wizardSectionCurrent
              }
            }
            // }

            let appDataFormatArgs = {
              'app:routeId': route._id
            }
            let primeAppKeys = (obj, prefix) => {
              prefix = prefix || 'app'
              Object.keys(obj).forEach(key => {
                let keyPrefix = prefix + ':' + key
                if (typeof obj[key] === 'object') {
                  primeAppKeys(obj[key], keyPrefix)
                } else {
                  appDataFormatArgs[keyPrefix] = obj[key]
                }
              })
            }
            primeAppKeys(appData)
            appData.json = {
              blocks: JSON.stringify(i18n, null, 2)
            }

            // req.session.autofields
            const routeVars = {
              routeId: route._id
            }
            Object.keys(route)
              .filter(key => key.startsWith('var:'))
              .forEach(key => {
                routeVars[key] = route[key]
              })
            let formatArgs = Object.assign(appDataFormatArgs, routeVars, autofields, values, (isEdit && req.query ? req.query : {}))
            if (routeInstanceFinal.overrides) {
              formatArgs = Object.assign({}, formatArgs, overrides)
            }
            let FormattedMethods = Formatted.setFormat(formatArgs, { errors })

            let routeVisited = route => {
              return req.session.visited[route]
            }
            // Noddy schemaless expansion
            // // let expandedBlocks = []
            // let formatProperties = [
            //   'label',
            //   'sublabel',
            //   'hint',
            //   'body',
            //   'title',
            //   'heading',
            //   'lede'
            // ]
            // let arrayProperties = [
            //   'options',
            //   'blocks'
            // ]
            // let objectProperties = [
            //   'subblock'
            // ]
            // let expandBlocks = (blocks, parent) => {
            //   let expanded = []
            //   blocks.forEach(name => {
            //     let block = Object.assign({}, getBlock(name))
            //     formatProperties.forEach(prop => {
            //       if (block[prop]) {
            //         block[prop] = FormattedMethods.getFormattedProp(name, prop)
            //       }
            //     })
            //     arrayProperties.forEach(prop => {
            //       if (block[prop]) {
            //         block[prop] = expandBlocks(block[prop], name)
            //       }
            //     })
            //     objectProperties.forEach(prop => {
            //       if (block[prop]) {
            //         block[prop] = expandBlocks([block[prop]])[0]
            //       }
            //     })
            //     let value = autofields[name]
            //     if (block._blockType === 'Option') {
            //       if (!block.value) {
            //         block.name = name
            //         block.value = 'yes'
            //       } else {
            //         value = autofields[parent]
            //       }
            //       if (block.value === value) {
            //         block.checked = true
            //       }
            //       let ariaControls = checkReveals(name, block.value)
            //       if (ariaControls) {
            //         block.ariaControls = ariaControls
            //       }
            //     } else if (typeof value !== 'undefined') {
            //       block.value = value
            //     }

            //     if (checkRevealRequired(name)) {
            //       block.ariaHidden = true
            //       block.hidden = !checkNoDependency(name)
            //     }

            //     if (errors && errors[name]) {
            //       block.error = FormattedMethods.getFormattedError(name, { error: errors[name] })
            //     }
            //     expanded.push(block)
            //   })
            //   return expanded
            // }
            // // let expandedBlocks = expandBlocks(businessBlocks)
            // // console.log(JSON.stringify(expandedBlocks, null, 2))

            routeInstanceFinal.values = values
            let nunjucksEnv = res.app.locals.settings.nunjucksEnv
            nunjucksEnv.addGlobal('getValue', getValue)
            nunjucksEnv.addGlobal('getMultipleValues', getMultipleValues)
            nunjucksEnv.addGlobal('getDisplayValue', (name, separator, vals, prefix) => {
              if (!vals) {
                vals = values
              }
              const unprefixedName = name
              name = (prefix || '') + name
              let output = getFieldValue(name)

              const blockType = FormattedMethods.getBlockProp(unprefixedName, '_blockType')
              if (components[blockType] && components[blockType].getDisplayValue) {
                const fieldValues = getFieldValues()
                const componentValues = {}
                Object.keys(fieldValues)
                  .filter(key => key.startsWith(name))
                  .map(key => key.replace(new RegExp('^' + name + '.'), ''))
                  .forEach(key => {
                    componentValues[key] = fieldValues[name + '.' + key]
                  })
                output = components[blockType].getDisplayValue(name, separator, componentValues, vals, fieldValues)
              } else {
                let value = getFieldValue(name)
                let options = FormattedMethods.getBlockProp(unprefixedName, 'options')
                if (options) {
                  let type = blockType
                  if (type === 'RadioGroup') {
                    options.forEach(opt => {
                      let optValue = FormattedMethods.getFormattedProp(opt, 'value')
                      if (optValue === value) {
                        output = FormattedMethods.getFormattedProp(opt, 'label')
                      }
                    })
                  } else if (type === 'CheckboxGroup') {
                    let yesses = []
                    options.forEach(opt => {
                      if (getFieldValue(opt)) {
                        yesses.push(FormattedMethods.getFormattedProp(opt, 'label'))
                      }
                    })
                    if (yesses.length) {
                      output = yesses.join(separator)
                    }
                  }
                } else if (blockType === 'Checkbox') {
                  const valueType = output || 'no'
                  output = FormattedMethods.getFormattedProp(unprefixedName, `display_${valueType}`)
                  if (!output) {
                    const defaultValue = valueType === 'yes' ? 'Yes' : 'No'
                    output = FormattedMethods.getFormattedProp(valueType, 'value', defaultValue)
                  }
                }
              }
              if (typeof output === 'string') {
                output = output.trim()
                if (!output) {
                  output = undefined
                }
              }
              if (output === undefined && getFieldValue(name + '_unsure')) {
                output = 'Don’t know'
              }
              if (output === undefined) {
                output = 'Not answered'
              }
              return output
            })

            Object.keys(FormattedMethods).forEach(key => {
              nunjucksEnv.addGlobal(key, FormattedMethods[key])
            })
            nunjucksEnv.addGlobal('updateRouteFormat', (route) => {
              const routeVars = FormattedMethods.getBlockVars(route)
              const routeIndex = FormattedMethods.getBlockProp(route, '_index')
              const routeDynamicIndex = FormattedMethods.getBlockProp(route, 'dynamicIndex')
              return FormattedMethods.updateFormat(Object.assign({}, {
                'app:routeId': route,
                'app:route:_index': routeIndex,
                'app:route:dynamicIndex': routeDynamicIndex
              }, routeVars))
            })
            nunjucksEnv.addGlobal('getFieldValue', getFieldValue)
            nunjucksEnv.addGlobal('errors', errors)
            nunjucksEnv.addGlobal('autofields', autofields)
            nunjucksEnv.addGlobal('values', values)
            // nunjucksEnv.addGlobal('getRouteUrl', getRouteUrl)
            nunjucksEnv.addGlobal('checkNoDependency', checkNoDependency)
            nunjucksEnv.addGlobal('checkReveals', checkReveals)
            nunjucksEnv.addGlobal('checkRevealRequired', checkRevealRequired)
            nunjucksEnv.addGlobal('getFlattenedBlocks', getFlattenedBlocks)
            nunjucksEnv.addGlobal('excludeBlockTypes', (blocks, excludes) => {
              return blocks.filter(block => {
                const blockType = FormattedMethods.getBlockProp(block, '_blockType')
                return !excludes.includes(blockType)
              })
            })
            nunjucksEnv.addGlobal('excludeRelated', (blocks, excludes) => {
              const blockKeys = blocks.slice()
              return blocks.filter(block => {
                let excludeMatch
                excludes.forEach(excludePattern => {
                  if (block.endsWith(excludePattern)) {
                    const relatedBlock = block.replace(excludePattern, '')
                    if (blockKeys.includes(relatedBlock)) {
                      excludeMatch = true
                    }
                  }
                })
                return !excludeMatch
              })
            })
            nunjucksEnv.addGlobal('routeVisited', routeVisited)
            nunjucksEnv.addGlobal('app', appData)
            let counterStash = {}
            nunjucksEnv.addGlobal('counter', key => {
              key = key || 'default'
              counterStash[key] = counterStash[key] || 0
              return counterStash[key]++
            })

            nunjucksEnv.addFilter('makeBlockEditable', function (str, name, type) {
              if (isEdit) {
                str = str.replace(/(\s*<[^>]+)/, '$1 data-block-type="' + type + '"')
              }
              return str
            })

            nunjucksEnv.addGlobal('flags', flags)
            if (isFlowchart) {
              routeInstanceFinal.template = 'flowchart'
            }
            // if (isOutcome) {
            //   routeInstanceFinal.template = 'outcome'
            // }
            // console.log('overrides', overrides)

            let template = routeInstanceFinal.template
            if (!template && routeWizard) {
              if (routeInstanceFinal.start_page) {
                template = 'wizard-start'
              } else {
                template = getBlockProp(routeInstanceFinal.wizard, 'stepTemplate')
                template = template || 'wizard-step'
              }
            }
            template = template || 'base'
            const templatePath = template.includes('/') ? template : `templates/${template}/${template}`
            // console.log({template})

            let allPages = []
            let addPageEntry = function (route, entry) {
              entry.url = route.url
              entry.heading = route.heading

              if (route.steps) {
                entry.steps = []
                route.steps.forEach((routeName, idx) => {
                  let step = routesFlattened[routeName]

                  entry.steps[idx] = addPageEntry(step, {})
                })
              }

              return entry
            }

            for (let r in routesFlattened) {
              let rt = routesFlattened[r]
              let data = addPageEntry(rt, {})

              allPages.push(data)
            }

            res.render(templatePath, {
              route: routeInstanceFinal,
              savedfields: JSON.stringify(autofields, null, 2),
              autofields,
              wizard: routeWizard,
              visited: req.session.visited,
              allPages: allPages,
              accessCode,
              routesFlattened: routesFlattened,
              flowchart: isFlowchart,
              edit: isEdit,
              app: appData
            }, (err, rendered) => {
              if (err) {
                // errorPage(err)
              } else {
                res.send(rendered)
                if (routeInstanceFinal.static && cacheDir && ENV && ENV !== 'testing') {
                  let pagePath = req.originalUrl.replace(/^\//, '').replace(/\?.*/, '')
                  pagePath = (pagePath || 'index') + '.html'
                  let pageDir = pagePath.replace(/((.*\/)*).*/, '$1').replace(/\/$/, '')
                  mkdirp(path.resolve(cacheDir, pageDir), mkdirErr => {
                    if (mkdirErr) {
                      throw new Error(mkdirErr)
                    }
                    fs.writeFile(path.resolve(cacheDir, pagePath), rendered, writeFileErr => {
                      if (writeFileErr) {
                        logger(writeFileErr)
                      } else {
                        logger(`Wrote ${pagePath} to ${cacheDir}`)
                      }
                    })
                  })
                }
              }
            })
          }
        })
        .catch(e => {
          logger('routes-metadata error', e)
          res.send('Something went wrong - sorry about that')
        })
    }
    routeHandler.isDynamicRoute = true
    router[method](url, routeHandler)
  })

  return router
}

const routesMetadata = (options) => {
  cacheDir = options.cacheDir
  appDir = options.appDir
  kitDir = options.kitDir
  return registerRoutes()
}
routesMetadata.globalMethods = globalMethods

module.exports = routesMetadata
