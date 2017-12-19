const jsonschema = require('jsonschema')
const validator = new jsonschema.Validator()
const { getBlockProp } = require('pflr-express-kit/lib/get-block')

// instance: '2016--23'
// name: 'format'
// argument: 'date'

const validate = (values, schema, name) => {
  let { day, month, year } = values
  let noValues
  if (!day && !month && !year) {
    noValues = true
  }
  day = day ? ('0' + day).replace(/0*(\d\d)$/, '$1') : day
  month = month ? ('0' + month).replace(/0*(\d\d)$/, '$1') : month

  if (!noValues) {
    const dateType = schema.date_type || 'day-month-year'
    if (!dateType.includes('day')) {
      day = '01'
    }
    if (!dateType.includes('month')) {
      month = '01'
    }
    if (!dateType.includes('year')) {
      year = '2000'
    }
  }

  // alt
  // if (schema.day === false) {
  //   day = '01'
  // }
  // if (schema.month === false) {
  //   month = '01'
  // }
  // if (schema.year === false) {
  //   year = '2000'
  // }

  schema.type = 'string'
  schema.format = 'date'

  const validateDate = input => {
    return validator.validate(input, schema).errors[0]
  }

  let validationError

  if (!day && !month && !year) {
    validationError = validateDate()
  } else {
    validationError = validateDate(`${year}-${month}-${day}`)
  }

  if (validationError) {
    validationError.composite = {}
    const validateDatePart = (part, partValue, input) => {
      if (partValue) {
        if (validateDate(input)) {
          validationError.composite[part] = { name: 'format' }
        }
      } else {
        validationError.composite[part] = { name: 'required' }
      }
    }
    validateDatePart('year', year, `${year}-01-01`)
    validateDatePart('month', month, `2000-${month}-01`)
    validateDatePart('day', day, `2000-01-${day}`)
  }

  return validationError ? [validationError] : []
}

const getDateValues = (name, componentValues) => {
  // handle multiple route elements
  name = name.replace(/.*_\d+_/, '')
  const dateType = getBlockProp(name, 'date_type', 'day-month-year')
  const day = dateType.includes('day')
  const month = dateType.includes('month')
  const year = dateType.includes('year')
  // alt
  // const day = getBlockProp(name, 'day', true)
  // const month = getBlockProp(name, 'month', true)
  // const year = getBlockProp(name, 'year', true)

  const dateValues = []
  if ((day && !componentValues.day) || (month && !componentValues.month) || (year && !componentValues.year)) {
    return dateValues
  }
  if (day) {
    dateValues.push(componentValues.day)
  }
  if (month) {
    dateValues.push(componentValues.month)
  }
  if (year) {
    dateValues.push(componentValues.year)
  }
  return dateValues
}

const setValue = (name, componentValues) => {
  const dateValues = getDateValues(name, componentValues)
  return dateValues.reverse().join('-')
}

const getDisplayValue = (name, separator, componentValues, vals, fieldValues) => {
  const dateValues = getDateValues(name, componentValues)
  return dateValues.join('/')
}

module.exports = {
  validate,
  setValue,
  getDisplayValue
}
