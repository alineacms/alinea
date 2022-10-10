import alinea from 'alinea'

// This type just acts as a container for the blog posts and is
// not used as a page in this template. Having it available might
// be useful if you have a use for a blog posts overview page on /blog
export const BlogContainer = alinea
  .type('Blog posts', {
    title: alinea.text('Title', {width: 0.5}),
    path: alinea.path('Path', {width: 0.5})
  })
  .configure({
    isContainer: true,
    contains: ['BlogPost']
  })
