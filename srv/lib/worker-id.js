// XSUAA sends user attributes as lists, and mocked users as plain values.
module.exports = req => [].concat(req.user.attr?.workerId ?? [])[0]
