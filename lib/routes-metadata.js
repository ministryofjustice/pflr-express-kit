'use strict'

const fs = require('fs')
const path = require('path')
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

let overrides = {}
let sessions = {}

let blockMethods = require('./get-block')
let { getBlock, getBlockProp, getBlockRaw, setBlock, getKeys } = blockMethods
// let getBlockRaw = blockMethods.getBlockRaw
// let getBlockProp = blockMethods.getBlockProp
// let setBlock = blockMethods.setBlock
// let setBlockProp = blockMethods.setBlockProp

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

function handleError (res, err) {
  res.status(500).send(err)
}

let getRouteUrl = function () {}
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
    let state = req.params.state.toLowerCase() !== 'off'
    flags[req.params.flag] = state
    if (req.headers.referer.match(/\/admin\/flags/)) {
      res.redirect(req.headers.referer)
    } else {
      res.json(flags)
    }
  })
  router.get('/admin/overrides', (req, res) => {
    res.render('admin/overrides/overrides', {
      overrides,
      json: JSON.stringify(overrides, null, 2),
      autofields: req.session.autofields
    })
  })
  router.get('/admin/autofields', (req, res) => {
    let autofields = req.session.autofields
    res.render('admin/autofields/autofields', {
      autofields,
      json: JSON.stringify(autofields, null, 2)
    })
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
  router.get('/admin/blocks', (req, res) => {
    let blockTypes = blocksDal.getBlockTypes().sort()
    res.render('admin/block-types/block-types', { blockTypes })
  })
  router.get('/admin/block/:block', (req, res) => {
    let block = getBlockRaw(req.params.block) || {}
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
    let stringProps = Object.keys(block).filter(key => {
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
    })
    // redirect single value props
    if (stringProps.length === 1 && typeof block[stringProps[0]] === 'string') {
      res.redirect(req.originalUrl + '/' + stringProps[0])
      return
    }
    res.render('admin/block/block', {
      block: req.params.block,
      blockJSON: JSON.stringify(getBlockRaw(req.params.block) || {}, null, 2),
      stringProps
    })
  })
  router.post('/admin/block/:block', (req, res) => {
    if (req.body && req.body.block) {
      let block = req.body.block
      if (typeof block === 'string') {
        try {
          block = JSON.parse(block)
        } catch (e) {
          res.status(500).send('Invalid JSON')
        }
      }
      setBlock(req.params.block, block)
      registerRoutes()
      res.redirect(req.originalUrl)
      // blocksDal.save().then(() => {
      //   res.redirect(req.originalUrl)
      // })
    } else {
      res.redirect(req.originalUrl)
    }
  })
  router.get('/admin/block/:block/:prop', (req, res) => {
    let block = req.params.block
    let doesNotExist = getBlockRaw(req.params.block) === undefined
    let prop = req.params.prop
    res.render('admin/string/string', {
      doesNotExist,
      block,
      prop,
      value: getBlockProp(block, prop) || ''
    })
  })
  router.post('/admin/block/:block/:prop', (req, res) => {
    let block = getBlockRaw(req.params.block)
    if (req.body && req.body.value !== undefined && block) {
      block[req.params.prop] = req.body.value
      setBlock(req.params.block, block)
      res.redirect(req.originalUrl)
      // blocksDal.save().then(() => {
      //   res.redirect(req.originalUrl)
      // })
    } else {
      res.redirect(req.originalUrl)
    }
  })
  router.get('/admin/string/:block', (req, res) => {
    res.render('admin/string/string', {
      type: 'string',
      block: req.params.block,
      value: getBlockProp(req.params.block, 'value') || ''
    })
  })
  router.post('/admin/string/:block', (req, res) => {
    if (req.body && req.body.value !== undefined) {
      let block = {
        type: 'string',
        value: req.body.value
      }
      setBlock(req.params.block, block)
      res.redirect(req.originalUrl)
      // blocksDal.save().then(() => {
      //   res.redirect(req.originalUrl)
      // })
    } else {
      res.redirect(req.originalUrl)
    }
  })
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

  let routesFlattened = {}
  // let blockRouteMapping = {}
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
      routeHierarchy.push(routeName)
      route.url = route.url || routeName
      if (route.url.indexOf('/') !== 0) {
        route.url = urlPrefix + '/' + route.url
      }
      if (route.steps) {
        // console.log('REDIRECT TOP', routeName, route.steps[0])
        routesFlattened[routeName].redirect = route.steps[0]
        route.steps.forEach((step, i) => {
          routesFlattened[step] = Object.assign({}, routesFlattened[step], getBlock(step))
          if (route.depends && !routesFlattened[step].depends) {
            routesFlattened[step].depends = route.depends
          }
          if (route.steps[i + 1]) {
            // console.log('REDIRECT STEP', step, route.steps[i + 1])
            routesFlattened[step].redirect = route.steps[i + 1]
          } else if (routes[index + 1] && hierarchy) {
            // console.log('MISSED STEP', step, routes[index + 1])
            routesFlattened[step].redirect = routes[index + 1]
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

  getRouteUrl = function (name, params, options) {
    options = options || {}
    let url = '/dev/null'
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
        const testUrl = originalUrl.replace(/\/(edit|flowchart)$/, '') || '/'
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
          value = getBlockProp(name, 'default')
        }
        return value
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
      let isEdit = !!req.path.match(/\/edit$/)

      let routeHandler = routeController(req, res)
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
      let accessCode = req.session.access_code.substr(0, 10)
      let blocks = (route.blocks || []).slice()
      // let blocksToValidate = blocks.slice()
      let blocksFound = flattenDeep(blocks.concat(recurseBlocks(blocks)))
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
              if (matchedKeys.length) {
                protectedBlocks[el] = true
              }
              matchedKeys.forEach(match => {
                blockTriggers[match] = blockTriggers[match] || []
                blockTriggers[match].push({
                  reveals: el,
                  match: new RegExp('^' + dep[inkey] + '$'),
                  yematch: '^' + dep[inkey] + '$',
                  negated: negated
                })
              })
              // console.log('key', key)
              // console.log('matchedKeys', matchedKeys)
            })
          })
          // console.log(el, 'deps', JSON.stringify(deps, null, 2))
        }
      })
      // console.log('protectedBlocks', protectedBlocks)
      // console.log('blockTriggers', blockTriggers)

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
      let errors
      let noRedirect
      if (req.method === 'POST') {
        Object.keys(req.body)
          .filter(key => key.match(/^(add|delete):/))
          .forEach(key => {
            const actionKey = key.replace(/^(add|delete):/, '')
            const actionValue = req.body[key] * 1
            delete req.body[key]
            if (key.startsWith('add')) {
              req.body[actionKey] = actionValue + 1
            }
            if (key.startsWith('delete')) {
              req.body[actionKey] = actionValue - 1
            }
            noRedirect = true
          })
        errors = {}
        blocksFound.forEach(el => {
          const prefixedEl = `${route._prefix || ''}${el}`
          let inboundValue = req.body[prefixedEl]
          let schema = Object.assign({}, getBlock(el))
          schema.type = schema._blockType.toLowerCase() || 'string'
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
          let validationError = validator.validate(inboundValue, schema).errors
          if (validationError.length) {
            errors[prefixedEl] = validationError[0]
          }
        })
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
        const routeCounter = route._counter
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
      let routeInstance = Object.assign({}, route, {
        values: values,
        autofields: autofields,
        overrides: overrides,
        blocks_base: route.blocks,
        blocks_found: blocksFound
      })
      let checkNoDependency = (name, skip, explicitDependency) => {
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
        if (depends) {
          // console.log('DEPENDS', JSON.stringify(depends, null, 2))
          // console.log('autofields', autofields)
          dependencyMet = matchProp(autofields, depends)
        }
        return dependencyMet
      }
      function checkRevealRequired (name) {
        return !!protectedBlocks[name]
      }
      if (isFlowchart || isEdit || req.query.showall) {
        checkNoDependency = () => true
      }
      let businessBlocks = routeInstance.blocks
      if (businessBlocks) {
        if (!checkNoDependency(routeInstance.id, false, routeInstance.depends)) {
          businessBlocks = []
        }
        businessBlocks = businessBlocks.filter(el => {
          return !getBlockProp(el, 'auxilliary') && checkNoDependency(el, true)
        })
        routeInstance.blocks = businessBlocks
      }
      routeHandler(routeInstance, Object.assign(
        {},
        blockMethods,
        {
          checkNoDependency: checkNoDependency
        }
      ))
        .then(routeOutcome => {
          let routeInstanceFinal = Object.assign({}, routeInstance, routeOutcome)
          let wizard = routeInstanceFinal.wizard
          let autofields = routeInstanceFinal.autofields
          if ((wizard && routesFlattened[wizard].useOverrides) || routeInstanceFinal.useOverrides) {
            autofields = Object.assign({}, autofields, overrides)
          }
          req.session.visited = req.session.visited || {}
          let wizardlastRoute
          if (wizard && wizardHierarchy[wizard]) {
            wizardlastRoute = wizardHierarchy[wizard].lastRoute
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
          let redirectUrl = routeUrls[routeInstanceFinal.redirect] || routeInstanceFinal.redirect
          if (!noRedirect && !errors && req.method === 'POST' && routeInstanceFinal.redirect && req.originalUrl !== routeInstanceFinal.redirect && req.body.updateForm !== 'yes') {
            // console.log('REDIRECTOR A')
            req.session.visited[routeName] = true
            if (req.originalUrl.match(/\/change$/)) {
              if (wizardlastRoute) {
                let redirectRoute = wizardlastRoute
                if (getBlockProp(wizardlastRoute, 'template') !== 'summary') {
                  let newRedirectRoute = getBlockProp(wizardlastRoute, 'redirect')
                  if (newRedirectRoute) {
                    redirectRoute = newRedirectRoute
                  }
                }
                redirectUrl = getRouteUrl(redirectRoute)
              }
              // redirectUrl = req.get('referrer')
            }
            res.redirect(redirectUrl)
          } else {
            if (route.blocks && (!routeInstanceFinal.blocks || !routeInstanceFinal.blocks.length)) {
              // console.log('REDIRECTOR B')
              logger(req.originalUrl, 'REDIRECT TO', redirectUrl)
              res.redirect(redirectUrl)
              return
            }
            // Work out number of wizard steps, the number of the step and the wizard flow data (for flowchart generation)
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

            let appData = {
              ENV,
              production,
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

            let appDataFormatArgs = {}
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
            let formatArgs = Object.assign(appDataFormatArgs, autofields, values, (isEdit && req.query ? req.query : {}))
            if (routeInstanceFinal.overrides) {
              formatArgs = Object.assign({}, formatArgs, overrides)
            }
            let FormattedMethods = Formatted.setFormat(formatArgs, { errors })

            let routeVisited = route => {
              return req.session.visited[route]
            }
            // let expandedBlocks = []
            let formatProperties = [
              'label',
              'sublabel',
              'hint',
              'body',
              'title',
              'heading',
              'lede'
            ]
            let arrayProperties = [
              'options',
              'blocks'
            ]
            let objectProperties = [
              'subblock'
            ]
            let expandBlocks = (blocks, parent) => {
              let expanded = []
              blocks.forEach(name => {
                let block = Object.assign({}, getBlock(name))
                formatProperties.forEach(prop => {
                  if (block[prop]) {
                    block[prop] = FormattedMethods.getFormattedProp(name, prop)
                  }
                })
                arrayProperties.forEach(prop => {
                  if (block[prop]) {
                    block[prop] = expandBlocks(block[prop], name)
                  }
                })
                objectProperties.forEach(prop => {
                  if (block[prop]) {
                    block[prop] = expandBlocks([block[prop]])[0]
                  }
                })
                let value = autofields[name]
                if (block._blockType === 'Option') {
                  if (!block.value) {
                    block.name = name
                    block.value = 'yes'
                  } else {
                    value = autofields[parent]
                  }
                  if (block.value === value) {
                    block.checked = true
                  }
                  let ariaControls = checkReveals(name, block.value)
                  if (ariaControls) {
                    block.ariaControls = ariaControls
                  }
                } else if (typeof value !== 'undefined') {
                  block.value = value
                }

                if (checkRevealRequired(name)) {
                  block.ariaHidden = true
                  block.hidden = !checkNoDependency(name)
                }

                if (errors && errors[name]) {
                  block.error = FormattedMethods.getFormattedError(name, { error: errors[name] })
                }
                expanded.push(block)
              })
              return expanded
            }
            // let expandedBlocks = expandBlocks(businessBlocks)
            // console.log(JSON.stringify(expandedBlocks, null, 2))

            routeInstanceFinal.values = values
            let nunjucksEnv = res.app.locals.settings.nunjucksEnv
            nunjucksEnv.addGlobal('getValue', (name, vals) => {
              return getFieldValue(name)
              // if (!vals) {
              //   vals = values
              // }
              // return values[name]
            })
            nunjucksEnv.addGlobal('getDisplayValue', (name, separator, vals) => {
              if (!vals) {
                vals = values
              }
              let value = getFieldValue(name)
              let output = getFieldValue(name)
              let options = FormattedMethods.getBlockProp(name, 'options')
              if (options) {
                let type = FormattedMethods.getBlockProp(name, '_blockType')
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
              }
              if (output === undefined) {
                output = 'Not answered'
              }
              return output
            })

            Object.keys(FormattedMethods).forEach(key => {
              nunjucksEnv.addGlobal(key, FormattedMethods[key])
            })
            nunjucksEnv.addGlobal('getFieldValue', getFieldValue)
            nunjucksEnv.addGlobal('errors', errors)
            nunjucksEnv.addGlobal('autofields', autofields)
            nunjucksEnv.addGlobal('values', values)
            // nunjucksEnv.addGlobal('getRouteUrl', getRouteUrl)
            nunjucksEnv.addGlobal('checkNoDependency', checkNoDependency)
            nunjucksEnv.addGlobal('checkReveals', checkReveals)
            nunjucksEnv.addGlobal('checkRevealRequired', checkRevealRequired)
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

            res.render(`templates/${template}/${template}`, {
              route: routeInstanceFinal,
              savedfields: JSON.stringify(autofields, null, 2),
              autofields,
              wizard: routeWizard,
              visited: req.session.visited,
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
  return registerRoutes()
}
routesMetadata.globalMethods = globalMethods

module.exports = routesMetadata
