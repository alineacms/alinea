// Source: https://github.com/ostosh/isomorphic-path/blob/b94fe4a737a103719e88f3f83a3cb26723307965/dist/isomorphic-path.browser.js#L1528

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
  /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/

function posixSplitPath(filename: string) {
  return splitPathRe.exec(filename)!.slice(1)
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

export function join(...args: Array<string>) {
  var path = ''
  for (var i = 0; i < args.length; i++) {
    var segment = args[i]
    if (typeof segment !== 'string') {
      throw new TypeError('Arguments to path.join must be strings')
    }
    if (segment) {
      if (!path) {
        path += segment
      } else {
        path += '/' + segment
      }
    }
  }
  return path
}

export function extname(path: string) {
  return posixSplitPath(path)[3]
}
