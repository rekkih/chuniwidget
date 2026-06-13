import type { User } from '@/store'
import { recordSync } from '@/store'
import { CHUNITHM } from '@/chunithm-net'
import { parseJstDate, SYNC_COOLDOWN_MS } from '@/utils'
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
        const { profile, collection } = await CHUNITHM.actAs(user.discordId).select(
            { profile: true, collection: true },
            { force },
        )
        await pushProfile(
            user.discordId,
            user.externalId,
            { ...profile, characterImageUrl: collection.characterUrl },
            user.descriptionMode as DescriptionMode,
        )
        const lastPlayedAt = parseJstDate(profile.lastPlayDate)
        await recordSync(user.discordId, now, lastPlayedAt)
        return { status: 'ok', profile: { name: profile.name, rating: profile.rating } }
    } catch (error) {
        if (error instanceof SessionExpiredError) return { status: 'session_expired' }
        return { status: 'error', error }
    }
}

export function startPeriodicRefresh(onSessionExpired?: OnSessionExpired): void {
    _startPeriodicRefresh(syncUser, onSessionExpired)
}
