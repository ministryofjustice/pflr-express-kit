const jsonschema = require('jsonschema')
const validator = new jsonschema.Validator()

// instance: '2016--23'
// name: 'format'
// argument: 'date'

const validate = (values, schema, name) => {
  let { day, month, year } = values
  day = day ? ('0' + day).replace(/0*(\d\d)$/, '$1') : day
  month = month ? ('0' + month).replace(/0*(\d\d)$/, '$1') : month

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

module.exports = {
  validate
}
