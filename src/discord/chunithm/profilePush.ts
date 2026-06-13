import { formatRelativeTime, numToRoman } from '@/utils'
import type { PlayerProfile } from '@/chunithm-net'
import { buildDescription, type DescriptionMode } from './descriptionModes'
import { text, img, stat, pushDynamicProfile } from '../common/pushProfile'

const FALLBACK_BANNER = 'https://placehold.co/400x200/1a1a2e/ffffff?text=CHUNITHM'
const FALLBACK_ICON = 'https://placehold.co/64x64/1a1a2e/ffffff?text=CHU'

export async function pushProfile(
    discordUserId: string,
    segaId: string,
    profile: PlayerProfile,
    descriptionMode: DescriptionMode | null,
): Promise<void> {
    const bannerUrl = profile.characterImageUrl ?? FALLBACK_BANNER
    const iconUrl = profile.characterImageUrl ?? FALLBACK_ICON
    const classLv = numToRoman(Number(profile.classImage.split('_').at(-1)?.split('.')[0]))
    const description = buildDescription(descriptionMode, profile)

    const dynamic = [
        text('name', profile.name || segaId),
        text('sub01', description),
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
        img('f4i', profile.classImage.replace('chunithm-net-eng.com/', 'chuwidgetimg.rek.lol/18/18/1/')),
        text('f4l', 'Class'),
        ...stat(5, formatRelativeTime(profile.lastPlayDate), 'Last Play'),
    ]

    await pushDynamicProfile(discordUserId, segaId, profile.name || segaId, dynamic)
}
