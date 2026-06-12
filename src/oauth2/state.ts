const states = new Map<string, { discordUserId: string; expiresAt: number }>()
const TTL_MS = 10 * 60 * 1000

export function createState(discordUserId: string): string {
    const state = crypto.randomUUID()
    states.set(state, {discordUserId, expiresAt: Date.now() + TTL_MS})
    return state
}

export function consumeState(state: string): string | null {
    const entry = states.get(state)
    if (!entry || Date.now() > entry.expiresAt) {
        states.delete(state)
        return null
    }
    states.delete(state)
    return entry.discordUserId
}
