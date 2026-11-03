const cds = require('@sap/cds')
const { identify } = require('./lib/identity')

cds.middlewares.add(identify, { after: 'auth' })
