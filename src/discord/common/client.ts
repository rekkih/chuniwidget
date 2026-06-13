export const DISCORD_API = 'https://discord.com/api/v10'

export async function botApi<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(`${DISCORD_API}${path}`, {
        method,
        headers: {
            Authorization: `Bot ${process.env.DISCORD_TOKEN!}`,
            'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Discord API ${method} ${path} -> ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
}
