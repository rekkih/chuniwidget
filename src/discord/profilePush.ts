import {botApi} from './client'
import {formatRelativeTime, numToRoman} from '@/utils'
import type {PlayerProfile} from '@/chunithm-net'
import {buildDescription, type DescriptionMode} from './descriptionModes'

type DynamicTextField = { type: 1; name: string; value: string };
type DynamicImageField = { type: 3; name: string; value: { url: string } };
type DynamicField = DynamicTextField | DynamicImageField;

function text(name: string, value: string): DynamicTextField {
    return {type: 1, name, value}
}

function img(name: string, url: string): DynamicImageField {
    return {type: 3, name, value: {url}}
}

function stat(index: number, value: string, label: string): DynamicField[] {
    return [
        text(`f${index}`, value),
        text(`f${index}l`, label),
    ]
}

const FALLBACK_BANNER = 'https://placehold.co/400x200/1a1a2e/ffffff?text=CHUNITHM'
const FALLBACK_ICON = 'https://placehold.co/64x64/1a1a2e/ffffff?text=CHU'

export async function pushProfile(
    discordUserId: string,
    segaId: string,
    profile: PlayerProfile,
    descriptionMode: DescriptionMode | null,
): Promise<void> {
    const appId = process.env.DISCORD_CLIENT_ID!

    const bannerUrl = profile.characterImageUrl ?? FALLBACK_BANNER
    const iconUrl = profile.characterImageUrl ?? FALLBACK_ICON

    const classLv = numToRoman(Number(profile.classImage.split('_').at(-1)?.split('.')[0]))

    const description = buildDescription(descriptionMode, profile)

    const dynamic: DynamicField[] = [
        text('name', profile.name || segaId),
        ...(description ? [text('sub01', description)] : []),

        img('primary_image', bannerUrl),
        img('preview_icon', iconUrl),
        img('preview_image', bannerUrl),

        text('preview_value', profile.rating),
        text('mini_text', profile.rating),
        text('activity_text', profile.name || segaId),

        ...stat(0, profile.rating, 'Rating'),
        ...stat(1, profile.overPower, 'Overpower'),
        ...stat(2, profile.playCount != null ? `${profile.playCount} (${profile.versionPlayCount} XVX)` : '0', 'Plays'),
        ...stat(3, profile.playerLevel, 'Lv'),

        text('f4', classLv ?? '0'),
        img('f4i', profile.classImage.replace('chunithm-net-eng.com', 'empty-brook-f048.rekkisomo.workers.dev')),
        text('f4l', 'Class'),

        ...stat(5, formatRelativeTime(profile.lastPlayDate), 'Last Play')
    ]

    await botApi(
        `/applications/${appId}/users/${discordUserId}/identities/${encodeURIComponent(segaId)}/profile`,
        'PATCH',
        {
            username: profile.name || segaId,
            metadata: {},
            data: {dynamic},
            data_trusted: true,
            connection_visible: true,
        },
    )
}
