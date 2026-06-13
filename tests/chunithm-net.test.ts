/**
 * Integration tests for CHUNITHM-NET fetching.
 *
 * Requires real SEGA credentials — no HTTP mocking.
 * Set TEST_SEGA_ID and TEST_SEGA_PASSWORD (and optionally TEST_SEGA_OTP) in env.
 * All tests are skipped if credentials are absent.
 *
 *   TEST_SEGA_ID=... TEST_SEGA_PASSWORD=... bun test tests/chunithm-net.test.ts
 */

import {beforeAll, describe, expect, mock, test} from 'bun:test'

// Mock @/store before any other import that transitively loads it.
// getUser returns a fake row whose chuniToken is filled in during beforeAll.
let testClal = ''
const TEST_DISCORD_ID = 'test-discord-id-000001'

mock.module('@/store', () => ({
    getUser: async (discordId: string) => ({
        discordId,
        segaId: 'test',
        chuniToken: testClal,
        externalId: null,
        descriptionMode: 'title',
        convertWidth: false,
        linkedAt: new Date(),
        lastSyncedAt: null,
        lastPlayedAt: null,
    }),
}))

import {login} from '@/chunithm-net/auth'
import {ChuniClient} from '@/chunithm-net/client'
import {fetchCollection} from '@/chunithm-net/fetchers/collection'
import {fetchPlayerData} from '@/chunithm-net/fetchers/playerData'
import {CHUNITHM, invalidateChuniCache} from '@/chunithm-net/chuni'

const segaId = process.env.TEST_SEGA_ID
const segaPassword = process.env.TEST_SEGA_PASSWORD
const segaOtp = process.env.TEST_SEGA_OTP
const SKIP = !segaId || !segaPassword

// ─── Setup ────────────────────────────────────────────────────────────────────

let client: ChuniClient

beforeAll(async () => {
    if (SKIP) return

    testClal = await login(segaId!, segaPassword!, segaOtp)
    client = new ChuniClient(testClal)
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('login', () => {
    test.skipIf(SKIP)('returns a non-empty clal token', () => {
        expect(testClal).toBeString()
        expect(testClal.length).toBeGreaterThan(0)
    })
})

// ─── Low-level fetchers ────────────────────────────────────────────────────────

describe('fetchPlayerData', () => {
    test.skipIf(SKIP)('returns PlayerData with expected shape', async () => {
        const data = await fetchPlayerData(client)

        expect(data.name).toBeString()
        expect(data.name.length).toBeGreaterThan(0)

        // Rating is formatted as digits with two decimal places, e.g. "16.50"
        expect(data.rating).toMatch(/^\d+\.\d{2}$/)

        expect(data.playCount).toBeNumber()
        expect(data.playCount).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(data.playCount)).toBe(true)

        expect(data.versionPlayCount).toBeNumber()
        expect(data.versionPlayCount).toBeGreaterThanOrEqual(0)

        expect(data.title).toBeString()
        expect(data.overPower).toBeString()
        expect(data.classImage).toBeString()

        // lastPlayDate is "YYYY/MM/DD HH:MM" (JST)
        expect(data.lastPlayDate).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/)

        expect(data.playerLevel).toBeString()
        expect(data.teamName).toBeString()
    })
})

describe('fetchCollection', () => {
    test.skipIf(SKIP)('returns a proxied character image URL', async () => {
        const data = await fetchCollection(client)

        expect(data.characterUrl).toBeString()
        // The absoluteUrl helper rewrites chunithm-net-eng.com → chuwidgetimg.rek.lol
        expect(data.characterUrl).toContain('chuwidgetimg.rek.lol')
    })
})

// ─── CHUNITHM.actAs().select() ────────────────────────────────────────────────

describe('CHUNITHM.actAs().select()', () => {
    beforeAll(() => {
        // Start each group with a clean cache so tests don't bleed into each other.
        invalidateChuniCache(TEST_DISCORD_ID)
    })

    test.skipIf(SKIP)('profile: true returns full PlayerData', async () => {
        const {profile} = await CHUNITHM.actAs(TEST_DISCORD_ID).select({profile: true}, {force: true})

        expect(profile.name).toBeString()
        expect(profile.rating).toMatch(/^\d+\.\d{2}$/)
        expect(profile.playCount).toBeGreaterThanOrEqual(0)
        expect(profile.lastPlayDate).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/)
    })

    test.skipIf(SKIP)('collection: true returns CollectionData', async () => {
        const {collection} = await CHUNITHM.actAs(TEST_DISCORD_ID).select({collection: true}, {force: true})

        expect(collection.characterUrl).toBeString()
        expect(collection.characterUrl).toContain('chuwidgetimg.rek.lol')
    })

    test.skipIf(SKIP)('profile + collection returns both', async () => {
        const {profile, collection} = await CHUNITHM.actAs(TEST_DISCORD_ID).select(
            {profile: true, collection: true},
            {force: true},
        )

        expect(profile.name).toBeString()
        expect(collection.characterUrl).toContain('chuwidgetimg.rek.lol')
    })

    test.skipIf(SKIP)('field picking returns only requested keys', async () => {
        const {profile} = await CHUNITHM.actAs(TEST_DISCORD_ID).select(
            {profile: {name: true, rating: true}},
            {force: true},
        )

        expect(profile.name).toBeString()
        expect(profile.rating).toBeString()
        // Other keys must not be present
        expect((profile as Record<string, unknown>).playCount).toBeUndefined()
        expect((profile as Record<string, unknown>).title).toBeUndefined()
    })

    test.skipIf(SKIP)('second select reuses cached data', async () => {
        const actor = CHUNITHM.actAs(TEST_DISCORD_ID)
        invalidateChuniCache(TEST_DISCORD_ID)

        const first = await actor.select({profile: true, collection: true}, {force: true})

        const t0 = performance.now()
        const second = await actor.select({profile: true, collection: true})
        const elapsed = performance.now() - t0

        // Cache hit should be well under 100 ms (no network round-trip)
        expect(elapsed).toBeLessThan(100)
        expect(second.profile.name).toBe(first.profile.name)
        expect(second.profile.rating).toBe(first.profile.rating)
    })

    test.skipIf(SKIP)('force: true bypasses cache and re-fetches', async () => {
        const actor = CHUNITHM.actAs(TEST_DISCORD_ID)

        // Prime the cache
        await actor.select({profile: true, collection: true})

        const t0 = performance.now()
        await actor.select({profile: true, collection: true}, {force: true})
        const elapsed = performance.now() - t0

        // A real fetch takes a lot longer than a cache read
        expect(elapsed).toBeGreaterThan(200)
    })

    test.skipIf(SKIP)('invalidateChuniCache causes next call to re-fetch', async () => {
        const actor = CHUNITHM.actAs(TEST_DISCORD_ID)

        await actor.select({profile: true})
        invalidateChuniCache(TEST_DISCORD_ID)

        // After invalidation, next call must go to the network — time it
        const t0 = performance.now()
        await actor.select({profile: true})
        const elapsed = performance.now() - t0

        expect(elapsed).toBeGreaterThan(200)
    })

    test.skipIf(SKIP)('different actors share no client or cache state', async () => {
        const a = CHUNITHM.actAs(TEST_DISCORD_ID)
        const b = CHUNITHM.actAs(TEST_DISCORD_ID)

        invalidateChuniCache(TEST_DISCORD_ID)

        // Both actors hit the network independently (no shared client)
        const [ra, rb] = await Promise.allSettled([
            a.select({profile: true}, {force: true}),
            b.select({profile: true}, {force: true}),
        ])

        // Both should resolve successfully (CHUNITHM-NET may serialize; this confirms
        // the actors don't share a client that would be corrupted by concurrent use)
        expect(ra.status).toBe('fulfilled')
        expect(rb.status).toBe('fulfilled')
    })
})
