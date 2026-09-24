import {invalidateAll} from '$app/navigation'
import {refreshPreviews} from 'alinea/sveltekit/client'

// Live previews rerun the load functions instead of reloading the page
refreshPreviews(invalidateAll)
