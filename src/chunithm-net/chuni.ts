import {ChuniClient} from './client'
import {fetchPlayerData, type PlayerData} from './fetchers/playerData'
import {fetchCollection, type CollectionData} from './fetchers/collection'
import {fetchCustomise, type CustomiseData} from './fetchers/customise'
import {getUser} from '@/store'
import {toHalfWidth, computeSyncInterval, parseJstDate, debugLog} from '@/utils'

// --- Types ---

type FieldSelection<T> = true | {[K in keyof T]?: true}

type ResolveSelection<T, S extends FieldSelection<T>> = S extends true
    ? T
    : {[K in keyof S as S[K] extends true ? K : never]: K extends keyof T ? T[K] : never}

export interface SelectQuery {
    profile?: FieldSelection<PlayerData>
    collection?: FieldSelection<CollectionData>
    customise?: FieldSelection<CustomiseData>
}

export type SelectResult<Q extends SelectQuery> =
    (Q extends {profile: FieldSelection<PlayerData>} ? {profile: ResolveSelection<PlayerData, Q['profile']>} : Record<never, never>) &
    (Q extends {collection: FieldSelection<CollectionData>} ? {collection: ResolveSelection<CollectionData, Q['collection']>} : Record<never, never>) &
    (Q extends {customise: FieldSelection<CustomiseData>} ? {customise: ResolveSelection<CustomiseData, Q['customise']>} : Record<never, never>)

export type PlayerProfile = PlayerData & {characterImageUrl: string}

// --- Cache ---

interface CacheEntry {
    playerData?: PlayerData
    collection?: CollectionData
    customise?: CustomiseData
    expiresAt: number
}

const profileCache = new Map<string, CacheEntry>()

export function invalidateChuniCache(discordId: string): void {
    profileCache.delete(discordId)
}

// --- Helpers ---

function normalizeWidth(p: PlayerData): PlayerData {
    return {
        ...p,
        name: toHalfWidth(p.name),
        title: toHalfWidth(p.title),
        teamName: toHalfWidth(p.teamName),
    }
}

function pickFields<T extends object, S extends FieldSelection<T>>(data: T, selection: S): ResolveSelection<T, S> {
    if (selection === true) return data as ResolveSelection<T, S>
    const result: Partial<T> = {}
    for (const key of Object.keys(selection) as (keyof T)[]) {
        if ((selection as Record<keyof T, boolean | undefined>)[key]) {
            result[key] = data[key]
        }
    }
    return result as ResolveSelection<T, S>
}

// --- Actor ---

export class ChuniActor {
    private _client: ChuniClient | null = null

    constructor(private readonly discordId: string) {}

    async select<Q extends SelectQuery>(query: Q, opts?: {force?: boolean}): Promise<SelectResult<Q>> {
        const user = await getUser(this.discordId)
        if (!user) throw new Error(`No user found for discordId ${this.discordId}`)

        const needsProfile = 'profile' in query
        const needsCollection = 'collection' in query
        const needsCustomise = 'customise' in query

        const now = Date.now()
        const cached = profileCache.get(this.discordId)
        const cacheAlive = !opts?.force && !!cached && cached.expiresAt > now

        const mustFetchPlayerData = needsProfile && !(cacheAlive && cached!.playerData)
        const mustFetchCollection = needsCollection && !(cacheAlive && cached!.collection)
        const mustFetchCustomise = needsCustomise && !(cacheAlive && cached!.customise)

        let playerData = cached?.playerData
        let collection = cached?.collection
        let customise = cached?.customise

        if (mustFetchPlayerData || mustFetchCollection || mustFetchCustomise) {
            this._client ??= new ChuniClient(user.chuniToken)

            // CHUNITHM-NET requires sequential requests; concurrent fetches get bounced.
            if (mustFetchPlayerData) {
                playerData = await fetchPlayerData(this._client)
                debugLog(`chuni.select: fetched playerData for ${this.discordId}`)
            }
            if (mustFetchCollection) {
                collection = await fetchCollection(this._client)
                debugLog(`chuni.select: fetched collection for ${this.discordId}`)
            }
            if (mustFetchCustomise) {
                customise = await fetchCustomise(this._client)
                debugLog(`chuni.select: fetched customise for ${this.discordId}`)
            }

            const ttl = computeSyncInterval(parseJstDate(playerData?.lastPlayDate ?? ''))
            profileCache.set(this.discordId, {
                playerData: playerData ?? cached?.playerData,
                collection: collection ?? cached?.collection,
                customise: customise ?? cached?.customise,
                expiresAt: now + ttl,
            })
        } else {
            debugLog(`chuni.select: cache hit for ${this.discordId}`)
        }

        const resolvedPlayerData = playerData
            ? (user.convertWidth ? normalizeWidth(playerData) : playerData)
            : undefined

        const result: Partial<SelectResult<Q>> = {}
        if (needsProfile && resolvedPlayerData) {
            (result as Record<string, unknown>)['profile'] = pickFields(resolvedPlayerData, query.profile!)
        }
        if (needsCollection && collection) {
            (result as Record<string, unknown>)['collection'] = pickFields(collection, query.collection!)
        }
        if (needsCustomise && customise) {
            (result as Record<string, unknown>)['customise'] = pickFields(customise, query.customise!)
        }
        return result as SelectResult<Q>
    }
}

// --- Public API ---

export const CHUNITHM = {
    actAs(discordId: string): ChuniActor {
        return new ChuniActor(discordId)
    },
}
