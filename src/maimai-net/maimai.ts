import { MaimaiClient } from './client'
import { fetchPlayerData, type PlayerData, fetchPlayerMetadata, type PlayerMetadata, fetchPlayerRecords, type PlayerRecords } from './fetchers/playerData'
import { getUser } from '@/store'
import { toHalfWidth, computeSyncInterval, parseJstDate } from '@/utils'
import { SegaActor, invalidateActorCache, type SelectQuery, type SelectResult } from '@/sega'

// --- Data shape ---

interface MaimaiData {
    profile: PlayerData
    metadata: PlayerMetadata
    records: PlayerRecords
}

// --- Re-exports for consumers ---

export type { SelectQuery, SelectResult }

// --- Helpers ---

function normalizeWidth(p: PlayerData): PlayerData {
    return { ...p, name: toHalfWidth(p.name) }
}

// --- Actor ---

class MaimaiActor extends SegaActor<MaimaiClient, MaimaiData> {
    private _convertWidth = false

    constructor(private readonly discordId: string) { super() }

    protected createClient(token: string): MaimaiClient {
        return new MaimaiClient(token)
    }

    protected readonly fetchers = {
        profile: fetchPlayerData,
        metadata: fetchPlayerMetadata,
        records: fetchPlayerRecords,
    }

    protected computeTtl(data: Partial<MaimaiData>): number {
        return computeSyncInterval(parseJstDate(data.records?.lastPlayDate ?? ''))
    }

    protected transform(data: Partial<MaimaiData>): Partial<MaimaiData> {
        if (this._convertWidth && data.profile) {
            return { ...data, profile: normalizeWidth(data.profile) }
        }
        return data
    }

    async select<Q extends SelectQuery<MaimaiData>>(query: Q, opts?: { force?: boolean }): Promise<SelectResult<MaimaiData, Q>> {
        const user = await getUser(this.discordId)
        if (!user) throw new Error(`No user found for discordId ${this.discordId}`)
        this._convertWidth = !!user.convertWidth
        return this.doSelect(query, this.discordId, user.chuniToken, opts)
    }
}

// --- Public API ---

export function invalidateMaimaiCache(discordId: string): void {
    invalidateActorCache(MaimaiActor, discordId)
}

export const MAIMAI = {
    actAs(discordId: string): MaimaiActor {
        return new MaimaiActor(discordId)
    },
}
