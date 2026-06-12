const enabled = Boolean(process.env.DEBUG)

export function debugLog(...args: unknown[]): void {
    if (enabled) console.log('[debug]', ...args)
}
