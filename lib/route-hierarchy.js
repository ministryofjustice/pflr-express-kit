'use strict'

function routeHierarchy (routes, pages) {
  function recurseHierachy (routes) {
    let hierarchy = []
    routes.forEach(routeName => {
      let stepHierarchy = {
        route: routeName
      }
      if (pages[routeName] && pages[routeName].steps) {
        let steps = pages[routeName].steps.slice()
        stepHierarchy.steps = recurseHierachy(steps)
      }
      hierarchy.push(stepHierarchy)
    })
    return hierarchy
  }
  let hierarchy = recurseHierachy(routes)
  let hierarchyStructure = {}
  hierarchy.forEach(wizard => {
    hierarchyStructure[wizard.route] = wizard.steps
    if (hierarchyStructure[wizard.route]) {
      let flatSteps = []
      let flattenSteps = function (steps) {
        steps = steps || []
        steps.forEach(function (step) {
          flatSteps.push(step.route)
          if (step.steps) {
            flattenSteps(step.steps)
          }
        })
      }
      flattenSteps(hierarchyStructure[wizard.route])
      if (flatSteps.length) {
        hierarchyStructure[wizard.route].stepsFlat = flatSteps
        hierarchyStructure[wizard.route].lastRoute = flatSteps[flatSteps.length - 1]
      }

      // console.log(hierarchyStructure[wizard.route].lastRoute)
    }
  })
  // console.log('hierarchyStructure', JSON.stringify(hierarchyStructure, null, 2))
  return hierarchyStructure
}

module.exports = routeHierarchy
