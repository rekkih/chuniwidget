import type { PlayerData, PlayerMetadata } from '@/maimai-net'
import { formatRelativeTime, toHalfWidth } from '@/utils'
import { buildDescription, type DescriptionMode } from './descriptionModes'
import { text, img, stat, pushDynamicProfile } from '../common/pushProfile'
import { PlayerRecords } from '@/maimai-net/fetchers/playerData'

const FALLBACK_BANNER = 'https://placehold.co/400x200/ff6b9d/ffffff?text=maimai+DX'
const FALLBACK_ICON = 'https://placehold.co/64x64/ff6b9d/ffffff?text=mai'

export async function pushProfile(
    discordUserId: string,
    segaId: string,
    profile: PlayerData,
    descriptionMode: DescriptionMode | null,
    metadata: PlayerMetadata,
    records: PlayerRecords,
    convertWidth?: boolean,
): Promise<void> {
    const bannerUrl = profile.charaUrl ?? FALLBACK_BANNER
    const iconUrl = profile.iconUrl ?? FALLBACK_ICON
    const description = buildDescription(descriptionMode, profile)
    const name = convertWidth ? toHalfWidth(profile.name) : profile.name

    const dynamic = [
        text('name', name || segaId),
        text('sub01', description),
        img('primary_image', bannerUrl.replace('maimaidx-eng.com/', 'maiwidgetimg.rek.lol/360/263/2/')),
        img('preview_icon', iconUrl.replace('maimaidx-eng.com/', 'maiwidgetimg.rek.lol/360/263/2/')),
        img('preview_image', bannerUrl.replace('maimaidx-eng.com/', 'maiwidgetimg.rek.lol/360/263/2/')),
        text('preview_value', profile.rating),
        text('mini_text', profile.rating),
        text('activity_text', name || segaId),
        ...stat(0, profile.rating, 'Rating'),
        ...stat(1, String(profile.starCount), 'Stars'),
        ...stat(2, metadata ? `${metadata.totalPlayCount} (${metadata.versionPlayCount} CiRCLE)` : '—', 'Plays'),
        ...stat(3, formatRelativeTime(records.lastPlayDate) || '—', 'Last Play'),

        ...(profile.courseRankUrl ? [
            img('f4i', profile.courseRankUrl.replace('maimaidx-eng.com/', 'maiwidgetimg.rek.lol/126/70/2/')),
            text('f4', ''),
            text('f4l', 'Course'),
        ] : []),
        ...(profile.classRankUrl ? [
            text('f5', ''),
            text('f5l', 'Class'),
            img('f5i', profile.classRankUrl.replace('maimaidx-eng.com/', 'maiwidgetimg.rek.lol/175/70/2/')),
        ] : []),
    ]

    await pushDynamicProfile(discordUserId, segaId, name || segaId, dynamic)
}
