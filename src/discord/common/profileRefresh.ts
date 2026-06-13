import type { User } from '@/store'
import { getAllLinkedUsers } from '@/store'
import { computeSyncInterval } from '@/utils'

export type SyncResult =
    | { status: 'ok'; profile: { name: string; rating: string } }
    | { status: 'cooldown'; nextSyncAt: Date }
    | { status: 'not_linked' }
    | { status: 'session_expired' }
    | { status: 'error'; error: unknown }

export type SyncFn = (user: User, force: boolean) => Promise<SyncResult>
export type OnSessionExpired = (discordId: string) => Promise<void>

export function isDueForSync(user: User): boolean {
    if (user.syncPaused) return false
    if (!user.lastSyncedAt) return true
    return Date.now() - user.lastSyncedAt.getTime() >= computeSyncInterval(user.lastPlayedAt ?? null)
}

export function startPeriodicRefresh(syncUser: SyncFn, onSessionExpired?: OnSessionExpired): void {
    const runPass = async () => {
        const linked = await getAllLinkedUsers()
        const due = linked.filter(isDueForSync)
        if (due.length === 0) return

        console.log(`[refresh] ${due.length} due / ${linked.length} total`)

        for (let i = 0; i < due.length; i++) {
            const user = due[i]!
            const result = await syncUser(user, true)

            if (result.status === 'ok') {
                console.log(`[refresh] ok ${user.discordId} (${result.profile.name}, ${result.profile.rating})`)
            } else if (result.status === 'session_expired') {
                console.warn(`[refresh] session_expired ${user.discordId}`)
                onSessionExpired?.(user.discordId).catch(err =>
                    console.error(`[refresh] Failed to notify ${user.discordId}:`, err)
                )
            } else if (result.status === 'error') {
                console.error(`[refresh] fail ${user.discordId}:`, result.error)
            }

            if (i < due.length - 1) await Bun.sleep(1000)
        }
    }

    runPass().catch(err => console.error('[refresh] Fatal error:', err))
    setInterval(() => {
        runPass().catch(err => console.error('[refresh] Tick error:', err))
    }, 60 * 1000)
}
