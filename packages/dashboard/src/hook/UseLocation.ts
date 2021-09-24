import {useEffect, useState} from 'react'

// Source: https://github.com/molefrog/wouter/blob/f7f735a1198f3ed4b4cd4bd321a3289d37c6fc25/README.md

// returns the current hash location in a normalized form
// (excluding the leading '#' symbol)
const currentLocation = () => {
  return window.location.hash.replace(/^#/, '') || '/'
}

const navigate = (to: string) => {
  const location = to.startsWith('/#') ? to.substr(2) : to
  window.location.hash = location
}

export const useHashLocation = (): [string, (to: string) => void] => {
  const [loc, setLoc] = useState(currentLocation())

  useEffect(() => {
    // this function is called whenever the hash changes
    const handler = () => setLoc(currentLocation())

    // subscribe to hash changes
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return [loc, navigate]
}
