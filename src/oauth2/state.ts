import { and, eq, gt, lt } from 'drizzle-orm'
import { db } from '@/db'
import { oauthStates } from '@/db/schema'

const TTL_MS = 10 * 60 * 1000

export async function createState(discordUserId: string): Promise<string> {
    const state = crypto.randomUUID()
    await db.insert(oauthStates).values({
        state,
        discordId: discordUserId,
        expiresAt: new Date(Date.now() + TTL_MS),
    })
    return state
}

export async function consumeState(state: string): Promise<string | null> {
    const [deleted] = await db.delete(oauthStates)
        .where(and(eq(oauthStates.state, state), gt(oauthStates.expiresAt, new Date())))
        .returning({discordId: oauthStates.discordId})
    return deleted?.discordId ?? null
}

export function startStateCleanup(): void {
    setInterval(async () => {
        await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date()))
    }, 5 * 60 * 1000)
}
