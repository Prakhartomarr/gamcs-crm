// GAMCS: frappe-ui resolves `resourceFetcher` when a resource is *created*. Stores such as
// stores/settings.js create resources at import time, which runs before main.js's body, so
// setConfig() there is too late and those requests go out as bare relative URLs. Importing
// this module first in main.js makes the config precede every other import.
import { setConfig, frappeRequest } from 'frappe-ui'

setConfig('resourceFetcher', frappeRequest)
