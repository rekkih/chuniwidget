import { MaimaiClient } from './client'
import { fetchPlayerData, type PlayerData, fetchPlayerMetadata, type PlayerMetadata, fetchPlayerRecords, type PlayerRecords } from './fetchers/playerData'
import { getUser } from '@/store'
import { SegaActor, invalidateActorCache, type SelectQuery, type SelectResult } from '@/sega'
import { computeSyncInterval, parseJstDate } from '@/utils'

// --- Data shape ---

interface MaimaiData {
    profile: PlayerData
    metadata: PlayerMetadata
    records: PlayerRecords
}

// --- Re-exports for consumers ---

export type { SelectQuery, SelectResult }

// --- Actor ---

class MaimaiActor extends SegaActor<MaimaiClient, MaimaiData> {
    constructor(private readonly discordId: string) { super() }

    protected createClient(token: string): MaimaiClient {
        return new MaimaiClient(token)
    }

    protected computeTtl(data: Partial<MaimaiData>): number {
        return computeSyncInterval(parseJstDate(data.records?.lastPlayDate ?? ''))
    }

    protected readonly fetchers = {
        profile: fetchPlayerData,
        metadata: fetchPlayerMetadata,
        records: fetchPlayerRecords,
    }

    async select<Q extends SelectQuery<MaimaiData>>(query: Q, opts?: { force?: boolean }): Promise<SelectResult<MaimaiData, Q>> {
        const user = await getUser(this.discordId)
        if (!user) throw new Error(`No user found for discordId ${this.discordId}`)
        return this.doSelect(query, this.discordId, user.chuniToken!, opts)
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
