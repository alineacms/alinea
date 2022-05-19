// This is a commonjs file so bundlers cannot statically analyze exports
// We could alternatively generate every possible export name

function fail() {
  throw new Error(`This should not be called in client bundle`)
}

module.exports = new Proxy(fail, {get: fail})
