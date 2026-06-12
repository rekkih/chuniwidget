import 'dotenv/config'
import {ensureWidgetConfig} from '../src/discord/widgetConfig'

ensureWidgetConfig()
    .then(() => {
        console.log('[setup] Done')
        process.exit(0)
    })
    .catch((err) => {
        console.error('[setup] Failed:', err)
        process.exit(1)
    })
