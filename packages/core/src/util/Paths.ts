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
