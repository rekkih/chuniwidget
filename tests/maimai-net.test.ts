/**
 * Integration tests for maimai DX NET fetching.
 *
 * Requires real SEGA credentials — no HTTP mocking.
 * Set TEST_SEGA_ID and TEST_SEGA_PASSWORD (and optionally TEST_SEGA_OTP) in env.
 * All tests are skipped if credentials are absent.
 *
 *   TEST_SEGA_ID=... TEST_SEGA_PASSWORD=... bun test tests/maimai-net.test.ts
 */

import { beforeAll, describe, expect, mock, test } from 'bun:test'

// Mock @/store before any other import that transitively loads it.
// getUser returns a fake row whose chuniToken is filled in during beforeAll.
let testClal = ''
const TEST_DISCORD_ID = 'test-discord-id-maimai-000001'

mock.module('@/store', () => ({
    getUser: async (discordId: string) => ({
        discordId,
        segaId: 'test',
        chuniToken: discordId === TEST_DISCORD_ID ? testClal : undefined,
        externalId: null,
        descriptionMode: 'title',
        convertWidth: false,
        linkedAt: new Date(),
        lastSyncedAt: null,
        lastPlayedAt: null,
    }),
}))

import { login } from '@/maimai-net/auth'
import { MaimaiClient } from '@/maimai-net/client'
import { fetchPlayerData } from '@/maimai-net/fetchers/playerData'
import { MAIMAI, invalidateMaimaiCache } from '@/maimai-net/maimai'

const segaId = process.env.TEST_SEGA_ID
const segaPassword = process.env.TEST_SEGA_PASSWORD
const segaOtp = process.env.TEST_SEGA_OTP
const SKIP = !segaId || !segaPassword

// ─── Setup ────────────────────────────────────────────────────────────────────

let client: MaimaiClient

beforeAll(async () => {
    if (SKIP) return

    testClal = await login(segaId!, segaPassword!, segaOtp)
    client = new MaimaiClient(testClal)
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

        // Rating is a string
        expect(data.rating).toBeString()
        expect(data.rating.length).toBeGreaterThan(0)

        expect(data.title).toBeString()
        expect(data.titleType).toBeString()

        expect(data.iconUrl).toBeString()
        expect(data.iconUrl?.length).toBeGreaterThan(0)

        expect(data.courseRankUrl).toBeString()
        expect(data.classRankUrl).toBeString()

        expect(data.starCount).toBeNumber()
        expect(data.starCount).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(data.starCount)).toBe(true)

        expect(data.charaUrl).toBeString()
        expect(data.charaUrl?.length).toBeGreaterThan(0)
    })
})

// ─── MAIMAI.actAs().fetchProfile() ──────────────────────────────────────────────

describe('MAIMAI.actAs().select({ profile: true })', () => {
    beforeAll(() => {
        // Start each group with a clean cache so tests don't bleed into each other.
        invalidateMaimaiCache(TEST_DISCORD_ID)
    })

    test.skipIf(SKIP)('returns full PlayerData', async () => {
        const { profile } = await MAIMAI.actAs(TEST_DISCORD_ID).select({ profile: true }, { force: true })

        expect(profile.name).toBeString()
        expect(profile.rating).toBeString()
        expect(profile.title).toBeString()
    })

    test.skipIf(SKIP)('cache hit returns cached data', async () => {
        const actor = MAIMAI.actAs(TEST_DISCORD_ID)

        // Prime the cache
        await actor.select({ profile: true }, { force: true })

        const t0 = performance.now()
        const { profile: cached } = await actor.select({ profile: true })
        const elapsed = performance.now() - t0

        // Cache hit should be well under 100 ms (no network round-trip)
        expect(elapsed).toBeLessThan(100)
        expect(cached.name).toBeString()
    })

    test.skipIf(SKIP)('force: true bypasses cache and re-fetches', async () => {
        const actor = MAIMAI.actAs(TEST_DISCORD_ID)

        // Prime the cache
        await actor.select({ profile: true })

        const t0 = performance.now()
        await actor.select({ profile: true }, { force: true })
        const elapsed = performance.now() - t0

        // A real fetch takes a lot longer than a cache read
        expect(elapsed).toBeGreaterThan(200)
    })

    test.skipIf(SKIP)('invalidateMaimaiCache causes next call to re-fetch', async () => {
        const actor = MAIMAI.actAs(TEST_DISCORD_ID)

        await actor.select({ profile: true })
        invalidateMaimaiCache(TEST_DISCORD_ID)

        // After invalidation, next call must go to the network — time it
        const t0 = performance.now()
        await actor.select({ profile: true })
        const elapsed = performance.now() - t0

        expect(elapsed).toBeGreaterThan(200)
    })
})
