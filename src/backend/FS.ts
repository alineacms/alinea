type NotIncluded = 'lutimes' | 'opendir' | 'watch' | 'cp'
export type FS = Omit<typeof import('fs/promises'), NotIncluded>
