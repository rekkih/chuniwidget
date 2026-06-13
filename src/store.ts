import { eq, isNotNull } from 'drizzle-orm'
import { db } from './db'
import { loginAttempts, type User, users } from './db/schema'
import { decryptSecret, encryptSecret } from './crypto'
import type { DescriptionMode } from './discord/descriptionModes'

export type { User }

const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 5

function decryptUser(user: User): User {
    return { ...user, chuniToken: decryptSecret(user.chuniToken) }
}

export async function setUser(discordId: string, segaId: string, chuniToken: string): Promise<void> {
    const encrypted = encryptSecret(chuniToken)
    await db.insert(users)
        .values({ discordId, segaId, chuniToken: encrypted })
        .onConflictDoUpdate({
            target: users.discordId,
            set: { segaId, chuniToken: encrypted, externalId: null, linkedAt: new Date() },
        })
}

export async function setExternalId(discordId: string, externalId: string): Promise<void> {
    await db.update(users)
        .set({ externalId })
        .where(eq(users.discordId, discordId))
}

export async function setDescriptionMode(discordId: string, mode: DescriptionMode): Promise<void> {
    // Force a stale lastSyncedAt so the next periodic pass re-pushes the widget with the new mode.
    await db.update(users)
        .set({descriptionMode: mode, lastSyncedAt: new Date('2026-01-01T00:00:00Z')})
        .where(eq(users.discordId, discordId))
}

export async function setConvertWidth(discordId: string, convertWidth: boolean): Promise<void> {
    // Force a stale lastSyncedAt so the next periodic pass re-pushes the widget with the new setting.
    await db.update(users)
        .set({convertWidth, lastSyncedAt: new Date('2026-01-01T00:00:00Z')})
        .where(eq(users.discordId, discordId))
}

export async function getUser(discordId: string): Promise<User | undefined> {
    const rows = await db.select()
        .from(users)
        .where(eq(users.discordId, discordId))
        .limit(1)
    return rows[0] ? decryptUser(rows[0]) : undefined
}

export async function getAllLinkedUsers(): Promise<User[]> {
    const rows = await db.select()
        .from(users)
        .where(isNotNull(users.externalId))
    return rows.map(decryptUser)
}

/**
 * Sliding-window rate limit for login attempts, persisted so it survives restarts.
 * Returns whether the attempt is allowed; when denied, includes ms until the window resets.
 */
export async function checkAndRecordLoginAttempt(
    discordId: string,
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    const now = new Date()
    const rows = await db.select()
        .from(loginAttempts)
        .where(eq(loginAttempts.discordId, discordId))
        .limit(1)
    const existing = rows[0]

    if (!existing || now.getTime() - existing.windowStart.getTime() >= LOGIN_WINDOW_MS) {
        await db.insert(loginAttempts)
            .values({ discordId, count: 1, windowStart: now })
            .onConflictDoUpdate({
                target: loginAttempts.discordId,
                set: { count: 1, windowStart: now },
            })
        return { allowed: true }
    }

    if (existing.count >= LOGIN_MAX_ATTEMPTS) {
        return {
            allowed: false,
            retryAfterMs: existing.windowStart.getTime() + LOGIN_WINDOW_MS - now.getTime(),
        }
    }

    await db.update(loginAttempts)
        .set({ count: existing.count + 1 })
        .where(eq(loginAttempts.discordId, discordId))
    return { allowed: true }
}

export async function deleteUser(discordId: string): Promise<void> {
    await db.delete(users).where(eq(users.discordId, discordId))
}

export async function recordSync(discordId: string, syncedAt: Date, lastPlayedAt: Date | null): Promise<void> {
    await db.update(users)
        .set({ lastSyncedAt: syncedAt, ...(lastPlayedAt !== null ? { lastPlayedAt } : {}) })
        .where(eq(users.discordId, discordId))
}
