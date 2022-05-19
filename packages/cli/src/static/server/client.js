function fail() {
  throw new Error(`This should not be called in client bundle`)
}

export default new Proxy(fail, {get: fail})
