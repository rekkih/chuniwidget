import 'dotenv/config'
import { ensureWidgetConfig as chuniWidgetConfig } from '../src/discord/chunithm/widgetConfig'
import { ensureWidgetConfig as maimaiWidgetConfig } from '../src/discord/maimai/widgetConfig'

const game = (process.env.GAME ?? 'chunithm').toLowerCase()
const ensureWidgetConfig = game === 'maimai' ? maimaiWidgetConfig : chuniWidgetConfig

ensureWidgetConfig(true)
    .then(() => {
        console.log('[setup] Done')
        process.exit(0)
    })
    .catch((err: unknown) => {
        console.error('[setup] Failed:', err)
        process.exit(1)
    })
