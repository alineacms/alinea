const funcs = new Map()

exports.backend = new Proxy(import('./backend.js'), {
  get(target, method) {
    if (funcs.get(method)) return funcs.get(method)
    const func = (...args) => {
      return target.then(({backend}) => backend[method](...args))
    }
    funcs.set(method, func)
    return func
  }
})
