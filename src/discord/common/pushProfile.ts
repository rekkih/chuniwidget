import { botApi } from './client'

export type DynamicTextField = { type: 1; name: string; value: string }
export type DynamicImageField = { type: 3; name: string; value: { url: string } }
export type DynamicField = DynamicTextField | DynamicImageField

export function text(name: string, value: string): DynamicTextField {
    return { type: 1, name, value }
}

export function img(name: string, url: string): DynamicImageField {
    return { type: 3, name, value: { url } }
}

export function stat(index: number, value: string, label: string): DynamicField[] {
    return [
        text(`f${index}`, value),
        text(`f${index}l`, label),
    ]
}

export async function pushDynamicProfile(
    discordUserId: string,
    segaId: string,
    username: string,
    dynamic: DynamicField[],
): Promise<void> {
    const appId = process.env.DISCORD_CLIENT_ID!
    await botApi(
        `/applications/${appId}/users/${discordUserId}/identities/${encodeURIComponent(segaId)}/profile`,
        'PATCH',
        {
            username,
            metadata: {},
            data: { dynamic },
            data_trusted: true,
            connection_visible: true,
        },
    )
}
