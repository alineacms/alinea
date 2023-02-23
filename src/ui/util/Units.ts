export const px = (pixels: number | string) =>
  typeof pixels === 'string' ? pixels : `${pixels / 16}rem`
