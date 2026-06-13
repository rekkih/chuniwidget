import { computeSyncInterval, debugLog } from '@/utils'
import type { SegaClient } from './base'

// --- Types ---

export type FieldSelection<T> = true | { [K in keyof T]?: true }

export type ResolveSelection<T, S extends FieldSelection<T>> = S extends true
    ? T
    : { [K in keyof S as S[K] extends true ? K : never]: K extends keyof T ? T[K] : never }

export type SelectQuery<TData extends object> = {
    [K in keyof TData]?: FieldSelection<TData[K]>
}

export type SelectResult<TData extends object, Q extends SelectQuery<TData>> = {
    [K in keyof TData & keyof Q]: ResolveSelection<TData[K], NonNullable<Q[K]> & FieldSelection<TData[K]>>
}

// --- Helpers ---

export function pickFields<T extends object, S extends FieldSelection<T>>(data: T, selection: S): ResolveSelection<T, S> {
    if (selection === true) return data as ResolveSelection<T, S>
    const result: Partial<T> = {}
    for (const key of Object.keys(selection) as (keyof T)[]) {
        if ((selection as Record<keyof T, boolean | undefined>)[key]) {
            result[key] = data[key]
        }
    }
    return result as ResolveSelection<T, S>
}

// --- Per-class cache registry ---

interface CacheEntry<TData extends object> {
    data: Partial<TData>
    expiresAt: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _caches = new Map<Function, Map<string, CacheEntry<any>>>()

function getCache<TData extends object>(ctor: Function): Map<string, CacheEntry<TData>> {
    if (!_caches.has(ctor)) _caches.set(ctor, new Map())
    return _caches.get(ctor)! as Map<string, CacheEntry<TData>>
}

export function invalidateActorCache(ctor: Function, cacheKey: string): void {
    getCache(ctor).delete(cacheKey)
}

// --- Base Actor ---

export abstract class SegaActor<TClient extends SegaClient, TData extends object> {
    protected _client: TClient | null = null

    protected abstract readonly fetchers: { [K in keyof TData]: (client: TClient) => Promise<TData[K]> }
    protected abstract createClient(token: string): TClient

    protected computeTtl(_data: Partial<TData>): number {
        return computeSyncInterval(null)
    }

    protected transform(data: Partial<TData>): Partial<TData> {
        return data
    }

    protected async doSelect<Q extends SelectQuery<TData>>(
        query: Q,
        cacheKey: string,
        token: string,
        opts?: { force?: boolean },
    ): Promise<SelectResult<TData, Q>> {
        const cache = getCache<TData>(this.constructor)
        const now = Date.now()
        const cached = cache.get(cacheKey)
        const cacheAlive = !opts?.force && !!cached && cached.expiresAt > now

        this._client ??= this.createClient(token)

        const newData: Partial<TData> = {}
        for (const key of Object.keys(query) as (keyof TData & string)[]) {
            if (cacheAlive && cached!.data[key] !== undefined) continue
            newData[key] = await this.fetchers[key](this._client)
            debugLog(`${this.constructor.name}.select: fetched ${key} for ${cacheKey}`)
        }

        const merged: Partial<TData> = { ...(cached?.data ?? {}), ...newData }

        if (Object.keys(newData).length > 0) {
            cache.set(cacheKey, { data: merged, expiresAt: now + this.computeTtl(merged) })
        } else {
            debugLog(`${this.constructor.name}.select: cache hit for ${cacheKey}`)
        }

        const transformed = this.transform(merged)
        const result: Partial<Record<string, unknown>> = {}
        for (const key of Object.keys(query) as (keyof TData & string)[]) {
            const val = transformed[key]
            if (val !== undefined) {
                result[key] = pickFields(val as object, query[key as keyof Q] as FieldSelection<object>)
            }
        }
        return result as SelectResult<TData, Q>
    }
}
