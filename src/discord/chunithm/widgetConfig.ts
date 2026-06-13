import { ensureWidgetConfig as _ensureWidgetConfig } from '../common/widgetConfig'

export const ensureWidgetConfig = (replace: boolean): Promise<void> => _ensureWidgetConfig('CHUNITHM', replace)
