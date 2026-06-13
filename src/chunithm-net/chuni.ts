import { ChuniClient } from './client'
import { fetchPlayerData, type PlayerData } from './fetchers/playerData'
import { fetchCollection, type CollectionData } from './fetchers/collection'
import { fetchCustomise, type CustomiseData } from './fetchers/customise'
import { getUser } from '@/store'
import { toHalfWidth, computeSyncInterval, parseJstDate } from '@/utils'
import { SegaActor, invalidateActorCache, type SelectQuery, type SelectResult } from '@/sega'

// --- Data shape ---

interface ChuniData {
    profile: PlayerData
    collection: CollectionData
    customise: CustomiseData
}

// --- Re-exports for consumers ---

export type { SelectQuery, SelectResult }
export type PlayerProfile = PlayerData & { characterImageUrl: string }

// --- Helpers ---

function normalizeWidth(p: PlayerData): PlayerData {
    return {
        ...p,
        name: toHalfWidth(p.name),
        title: toHalfWidth(p.title),
        teamName: toHalfWidth(p.teamName),
    }
}

// --- Actor ---

class ChuniActor extends SegaActor<ChuniClient, ChuniData> {
    private _convertWidth = false

    constructor(private readonly discordId: string) { super() }

    protected createClient(token: string): ChuniClient {
        return new ChuniClient(token)
    }

    protected readonly fetchers = {
        profile: fetchPlayerData,
        collection: fetchCollection,
        customise: fetchCustomise,
    }

    protected computeTtl(data: Partial<ChuniData>): number {
        return computeSyncInterval(parseJstDate(data.profile?.lastPlayDate ?? ''))
    }

    protected transform(data: Partial<ChuniData>): Partial<ChuniData> {
        if (this._convertWidth && data.profile) {
            return { ...data, profile: normalizeWidth(data.profile) }
        }
        return data
    }

    async select<Q extends SelectQuery<ChuniData>>(query: Q, opts?: { force?: boolean }): Promise<SelectResult<ChuniData, Q>> {
        const user = await getUser(this.discordId)
        if (!user) throw new Error(`No user found for discordId ${this.discordId}`)
        this._convertWidth = !!user.convertWidth
        return this.doSelect(query, this.discordId, user.chuniToken, opts)
    }
}

// --- Public API ---

export function invalidateChuniCache(discordId: string): void {
    invalidateActorCache(ChuniActor, discordId)
}

export const CHUNITHM = {
    actAs(discordId: string): ChuniActor {
        return new ChuniActor(discordId)
    },
}
