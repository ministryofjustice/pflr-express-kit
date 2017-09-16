const jsonschema = require('jsonschema')
const validator = new jsonschema.Validator()

// route-metadata

// if (blah._composite) // blah._composite = ['day', 'month', 'year']
// const compositeValues = {}
// blah._composite.forEach(comp => compositeValues[comp] = getValues()[comp])
// const errorResult = compositeController.validate(compositeValues, schema, el, getValues())

// so return error for the composite value
// but also mark error parts
// error.name, error.argument

const validate = (values, schema, name, rawValues) => {
  let { day, month, year } = values
  day = day ? ('0' + day).replace(/.*(\d\d)$/, '$1') : day
  month = month ? ('0' + month).replace(/.*(\d\d)$/, '$1') : month

  schema.format = 'date'

  const validateDate = input => validator.validate(input, schema).errors[0]

  let validationError

  // const errors = {}

  if (!day && !month && !year) {
    validationError = validateDate()
  } else {
    validationError = validateDate(`${year}-${month}-${day}`)

    if (validationError) {
      validationError.composite = {}
      const validateDatePart = (part, partValue, input) => {
        if (partValue) {
          if (validateDate(input)) {
            validationError.composite[part] = 'format'
          }
        } else {
          validationError.composite[part] = 'required'
        }
      }
      validateDatePart('year', year, `${year}-01-01`)
      validateDatePart('month', month, `2000-${month}-01`)
      validateDatePart('day', day, `2000-01-${day}`)
    }
  }
  return validationError ? [validationError] : []
}

module.exports = {
  validate
}
