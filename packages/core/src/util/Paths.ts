// Source: https://github.com/ostosh/isomorphic-path/blob/b94fe4a737a103719e88f3f83a3cb26723307965/dist/isomorphic-path.browser.js#L1528

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
  /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/

function posixSplitPath(filename: string) {
  return splitPathRe.exec(filename)!.slice(1)
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts: Array<string>, allowAboveRoot: boolean) {
  var res = []
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]

    // ignore empty parts
    if (!p || p === '.') continue

    if (p === '..') {
      if (res.length && res[res.length - 1] !== '..') {
        res.pop()
      } else if (allowAboveRoot) {
        res.push('..')
      }
    } else {
      res.push(p)
    }
  }

  return res
}

export function isAbsolute(path: string) {
  return path.charAt(0) === '/'
}

export function normalize(path: string) {
  path = path.replace(/\\/g, '/')

  var absolute = isAbsolute(path),
    trailingSlash = path && path[path.length - 1] === '/'

  // Normalize the path
  path = normalizeArray(path.split('/'), !absolute).join('/')

  if (!path && !absolute) {
    path = '.'
  }
  if (path && trailingSlash) {
    path += '/'
  }

  return (absolute ? '/' : '') + path
}

export function dirname(path: string) {
  var result = posixSplitPath(path),
    root = result[0],
    dir = result[1]

  if (!root && !dir) {
    // No dirname whatsoever
    return '.'
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1)
  }

  return root + dir
}

export function basename(path: string, ext?: string) {
  var f = posixSplitPath(path)[2]
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length)
  }
  return f
}

export function join(...args: Array<string | undefined>) {
  var path = ''
  for (var i = 0; i < args.length; i++) {
    var segment = args[i]
    if (typeof segment !== 'string') {
      continue
    }
    if (segment) {
      if (!path) {
        path += segment
      } else {
        path += '/' + segment
      }
    }
  }
  return normalize(path)
}

export function extname(path: string) {
  return posixSplitPath(path)[3]
}

// returns an array with empty elements removed from either end of the input
// array or the original array if no elements need to be removed
function trimArray<T>(arr: Array<T>): Array<T> {
  var lastIndex = arr.length - 1
  var start = 0
  for (; start <= lastIndex; start++) {
    if (arr[start]) break
  }

  var end = lastIndex
  for (; end >= 0; end--) {
    if (arr[end]) break
  }

  if (start === 0 && end === lastIndex) return arr
  if (start > end) return []
  return arr.slice(start, end + 1)
}

export function resolve(...args: Array<string>) {
  var resolvedPath = '',
    resolvedAbsolute = false

  for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = i >= 0 ? args[i] : process.cwd()

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings')
    } else if (!path) {
      continue
    }

    resolvedPath = path + '/' + resolvedPath
    resolvedAbsolute = path[0] === '/'
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(
    resolvedPath.split('/'),
    !resolvedAbsolute
  ).join('/')

  return (resolvedAbsolute ? '/' : '') + resolvedPath || '.'
}

export function relative(from: string, to: string) {
  from = resolve(from).substr(1)
  to = resolve(to).substr(1)

  var fromParts = trimArray(from.split('/'))
  var toParts = trimArray(to.split('/'))

  var length = Math.min(fromParts.length, toParts.length)
  var samePartsLength = length
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i
      break
    }
  }

  var outputParts = []
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..')
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength))

  return outputParts.join('/')
}

// https://stackoverflow.com/a/45242825
export function contains(parent: string, child: string): boolean {
  parent = normalize(parent)
  child = normalize(child)
  const asRelative = relative(parent, child)
  const isSubdir =
    asRelative && !asRelative.startsWith('..') && !isAbsolute(asRelative)
  return Boolean(isSubdir)
}
