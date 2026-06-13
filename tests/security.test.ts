/**
 * Security-hardening tests.
 *
 * Crypto tests run always (no external dependencies).
 * DB tests require DATABASE_URL — skipped when absent.
 *
 *   DATABASE_URL=... bun test tests/security.test.ts
 */

import {afterAll, describe, expect, mock, test} from 'bun:test'
import {eq} from 'drizzle-orm'

// Prevent process.exit(1) in db/index.ts when DATABASE_URL is absent.
if (!process.env.DATABASE_URL) {
    mock.module('@/db', () => ({db: null}))
}

import {decryptSecret, encryptSecret} from '@/crypto'
import {db} from '@/db'
import {loginAttempts, oauthStates} from '@/db/schema'
import {createState, consumeState} from '@/oauth2/state'
import {checkAndRecordLoginAttempt} from '@/store'

const HAS_DB = Boolean(process.env.DATABASE_URL)

const stateCleanup: string[] = []
const rlCleanup: string[] = []

afterAll(async () => {
    if (!HAS_DB) return
    for (const id of stateCleanup)
        await db.delete(oauthStates).where(eq(oauthStates.discordId, id))
    for (const id of rlCleanup)
        await db.delete(loginAttempts).where(eq(loginAttempts.discordId, id))
})

function sid(tag: string): string {
    const id = `_test_state_${tag}`
    stateCleanup.push(id)
    return id
}

function rid(tag: string): string {
    const id = `_test_rl_${tag}`
    rlCleanup.push(id)
    return id
}

// ─── Crypto ──────────────────────────────────────────────────────────────────

describe('crypto', () => {
    test('round-trip: decrypt(encrypt(x)) === x', () => {
        const plain = 'test-clal-token-abc123'
        expect(decryptSecret(encryptSecret(plain))).toBe(plain)
    })

    test('unique IV: two encryptions of the same value differ', () => {
        expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
    })

    test('tampered ciphertext throws (GCM auth fails)', () => {
        const [iv, tag] = encryptSecret('secret').split(':')
        expect(() => decryptSecret(`${iv}:${tag}:${Buffer.from('bad').toString('base64')}`)).toThrow()
    })

    test('tampered auth tag throws', () => {
        const [iv, , ct] = encryptSecret('secret').split(':')
        expect(() => decryptSecret(`${iv}:${Buffer.alloc(16).toString('base64')}:${ct}`)).toThrow()
    })

    test('malformed blob throws', () => {
        expect(() => decryptSecret('notavalidblob')).toThrow('Malformed encrypted secret')
    })
})

// ─── OAuth state ─────────────────────────────────────────────────────────────

describe('oauth state', () => {
    test.skipIf(!HAS_DB)('createState + consumeState happy path', async () => {
        const discordId = sid('basic')
        const state = await createState(discordId)
        expect(typeof state).toBe('string')
        expect(state.length).toBeGreaterThan(0)
        expect(await consumeState(state)).toBe(discordId)
    })

    test.skipIf(!HAS_DB)('single-use: second consumeState returns null', async () => {
        const state = await createState(sid('once'))
        await consumeState(state)
        expect(await consumeState(state)).toBeNull()
    })

    test.skipIf(!HAS_DB)('unknown state returns null', async () => {
        expect(await consumeState(crypto.randomUUID())).toBeNull()
    })

    test.skipIf(!HAS_DB)('expired state returns null', async () => {
        const state = crypto.randomUUID()
        await db.insert(oauthStates).values({
            state,
            discordId: sid('expired'),
            expiresAt: new Date(Date.now() - 1000),
        })
        expect(await consumeState(state)).toBeNull()
    })

    test.skipIf(!HAS_DB)('concurrent consumeState: only one succeeds (atomic DELETE RETURNING)', async () => {
        const discordId = sid('concurrent')
        const state = await createState(discordId)
        const [r1, r2] = await Promise.all([consumeState(state), consumeState(state)])
        const successes = [r1, r2].filter(Boolean)
        expect(successes).toHaveLength(1)
        expect(successes[0]).toBe(discordId)
    })
})

// ─── Login rate limiter ───────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5 // must match LOGIN_MAX_ATTEMPTS in store.ts

describe('login rate limiter', () => {
    test.skipIf(!HAS_DB)('allows exactly MAX_ATTEMPTS then blocks', async () => {
        const discordId = rid('basic')
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            expect((await checkAndRecordLoginAttempt(discordId)).allowed).toBe(true)
        }
        const blocked = await checkAndRecordLoginAttempt(discordId)
        expect(blocked.allowed).toBe(false)
        expect(blocked.retryAfterMs).toBeGreaterThan(0)
    })

    test.skipIf(!HAS_DB)('concurrent attempts at the limit serialize correctly (SELECT FOR UPDATE)', async () => {
        const discordId = rid('concurrent')
        // Advance to MAX_ATTEMPTS - 1 sequentially so the row exists before concurrent access.
        for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
            await checkAndRecordLoginAttempt(discordId)
        }
        // Fire MAX_ATTEMPTS concurrent calls; exactly 1 should be allowed.
        const results = await Promise.all(
            Array.from({length: MAX_ATTEMPTS}, () => checkAndRecordLoginAttempt(discordId)),
        )
        const allowed = results.filter(r => r.allowed)
        expect(allowed).toHaveLength(1)
    })
})
