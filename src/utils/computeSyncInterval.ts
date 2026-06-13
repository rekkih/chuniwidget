export const SYNC_COOLDOWN_MS = 30 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

export function computeSyncInterval(lastPlayedAt: Date | null): number {
    if (!lastPlayedAt) return ONE_DAY_MS
    const elapsed = Date.now() - lastPlayedAt.getTime()
    if (elapsed < ONE_HOUR_MS) return SYNC_COOLDOWN_MS
    if (elapsed < ONE_DAY_MS) return ONE_HOUR_MS
    return ONE_DAY_MS
}
