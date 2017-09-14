const request = require('request-promise-native')
const cheerio = require('cheerio')

const flowchartController = (req, res) => {
  return function (route, methods) {
    if (!route.fullRender) {
      return Promise.resolve(route)
    }

    const { getRouteUrl } = methods
    let flowchartRoutes = route.wizardHierarchy[route.wizard]
                            .map(step => step.route)
                            .filter(routeId => !routeId.match(/_[2-9]\d*$/))
                            .map(routeId => {
                              return {
                                id: routeId,
                                url: getRouteUrl(routeId, {}, {edit: true})
                              }
                            })

    route.flowchartOutput = {}
    const getPage = page => {
      return request(`http://localhost:3000${page.url}`)
              .then(resContent => {
                const $ = cheerio.load(resContent)
                const pageContent = $('#contentTarget').html()
                route.flowchartOutput[page.id.replace(/_1$/, '')] = pageContent
              })
    }
    const start = new Date()
    return Promise.all(flowchartRoutes.map(getPage))
            .then(res => {
              const end = new Date()
              console.log('Flowchart generation took', end - start)
              return route
            })
            .catch(err => {
              console.log('Flowchart generation failed', err)
            })
  }
}

module.exports = flowchartController
