import type {User} from '@/store'
import {getAllLinkedUsers, recordSync} from '@/store'
import {CHUNITHM} from '@/chunithm-net'
import {parseJstDate, computeSyncInterval, SYNC_COOLDOWN_MS} from '@/utils'
import {pushProfile} from './profilePush'
import type {DescriptionMode} from './descriptionModes'

export type SyncResult =
    | { status: 'ok'; profile: { name: string; rating: string } }
    | { status: 'cooldown'; nextSyncAt: Date }
    | { status: 'not_linked' }
    | { status: 'error'; error: unknown }

function isDueForSync(user: User): boolean {
    if (!user.lastSyncedAt) return true
    return Date.now() - user.lastSyncedAt.getTime() >= computeSyncInterval(user.lastPlayedAt ?? null)
}

export async function syncUser(user: User, force = false): Promise<SyncResult> {
    if (!user.externalId) return {status: 'not_linked'}

    if (!force && user.lastSyncedAt) {
        const elapsed = Date.now() - user.lastSyncedAt.getTime()
        if (elapsed < SYNC_COOLDOWN_MS) {
            return {
                status: 'cooldown',
                nextSyncAt: new Date(user.lastSyncedAt.getTime() + SYNC_COOLDOWN_MS),
            }
        }
    }

    try {
        const now = new Date()
        const {profile, collection} = await CHUNITHM.actAs(user.discordId).select(
            {profile: true, collection: true},
            {force},
        )
        await pushProfile(
            user.discordId,
            user.externalId,
            {...profile, characterImageUrl: collection.characterUrl},
            user.descriptionMode as DescriptionMode,
        )
        const lastPlayedAt = parseJstDate(profile.lastPlayDate)
        await recordSync(user.discordId, now, lastPlayedAt)
        return {status: 'ok', profile: {name: profile.name, rating: profile.rating}}
    } catch (error) {
        return {status: 'error', error}
    }
}

async function runRefreshPass(): Promise<void> {
    const linked = await getAllLinkedUsers()
    const due = linked.filter(isDueForSync)

    if (due.length === 0) return

    console.log(`[refresh] ${due.length} due / ${linked.length} total`)

    for (let i = 0; i < due.length; i++) {
        const user = due[i]!
        const result = await syncUser(user, true)

        if (result.status === 'ok') {
            console.log(`[refresh] ok ${user.discordId} (${result.profile.name}, ${result.profile.rating})`)
        } else if (result.status === 'error') {
            console.error(`[refresh] fail ${user.discordId}:`, result.error)
        }

        if (i < due.length - 1) await Bun.sleep(1000)
    }
}

export function startPeriodicRefresh(): void {
    runRefreshPass().catch(err => console.error('[refresh] Fatal error:', err))
    setInterval(() => {
        runRefreshPass().catch(err => console.error('[refresh] Tick error:', err))
    }, 60 * 1000)
}
