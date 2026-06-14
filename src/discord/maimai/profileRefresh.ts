import type { User } from '@/store'
import { recordSync } from '@/store'
import { MAIMAI } from '@/maimai-net'
import { SYNC_COOLDOWN_MS } from '@/utils'
import { pushProfile } from './profilePush'
import type { DescriptionMode } from './descriptionModes'
import { startPeriodicRefresh as _startPeriodicRefresh, type SyncResult, type OnSessionExpired } from '../common/profileRefresh'
import { SessionExpiredError } from '@/sega'

export type { SyncResult }

export async function syncUser(user: User, force = false): Promise<SyncResult> {
    if (!user.externalId) return { status: 'not_linked' }

    if (!force && user.lastSyncedAt) {
        const elapsed = Date.now() - user.lastSyncedAt.getTime()
        if (elapsed < SYNC_COOLDOWN_MS) {
            return { status: 'cooldown', nextSyncAt: new Date(user.lastSyncedAt.getTime() + SYNC_COOLDOWN_MS) }
        }
    }

    try {
        const now = new Date()
        const { profile, metadata, records } = await MAIMAI.actAs(user.discordId).select({ profile: true, metadata: true, records: true }, { force })
        await pushProfile(
            user.discordId,
            user.externalId,
            profile,
            user.descriptionMode as DescriptionMode,
            metadata,
            records,
        )
        await recordSync(user.discordId, now, null)
        return { status: 'ok', profile: { name: profile.name, rating: profile.rating } }
    } catch (error) {
        if (error instanceof SessionExpiredError) return { status: 'session_expired' }
        return { status: 'error', error }
    }
}

export function startPeriodicRefresh(onSessionExpired?: OnSessionExpired): void {
    _startPeriodicRefresh(syncUser, onSessionExpired)
}
