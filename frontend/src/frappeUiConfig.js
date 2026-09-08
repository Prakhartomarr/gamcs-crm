// frappe-ui resolves `resourceFetcher` when a resource fetches, and a resource
// created at module scope with `auto: true` (stores/settings.js,
// stores/notifications.js) fetches while it is being imported. ES module
// imports are evaluated before main.js's own body runs, so `setConfig()` there
// is too late for them: they fall back to frappe-ui's plain `request` and go
// out as bare relative URLs without the /api/method prefix or the CSRF token.
//
// Importing this module first in main.js makes the config precede every other
// import. Keep it free of app imports.
import { setConfig, frappeRequest } from 'frappe-ui'

setConfig('resourceFetcher', frappeRequest)
