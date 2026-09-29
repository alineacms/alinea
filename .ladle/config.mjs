/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.tsx',
  // Components with a finalized, react-aria free API are listed first
  storyOrder: stories => [
    ...stories.filter(id => id.startsWith('pure-components--')),
    ...stories.filter(id => !id.startsWith('pure-components--'))
  ]
}
