import {parse} from 'node-html-parser'
import {ChuniClient} from './client'
import {qs} from './dom'
import {debugLog, toHalfWidth} from '@/utils'

export interface PlayerProfile {
    name: string
    rating: string
    characterImageUrl: string
    title: string
    playCount: number
    versionPlayCount: number
    overPower: string
    classImage: string
    lastPlayDate: string
    playerLevel: string
    teamName: string
}

function extractLastPart(url: string): string {
    return (url.split('_').at(-1) ?? '').split('.')[0]
}

function parseRatingImages(srcs: string[]): string {
    let rating = ''
    for (const src of srcs) {
        const part = extractLastPart(src)
        if (part === 'comma') {
            rating += '.'
        } else if (part.length >= 2) {
            rating += part[1]
        }
    }
    return rating || '0.00'
}

function absoluteUrl(src: string | undefined | null): string | null {
    if (!src) return null
    return src.replace('chunithm-net-eng.com/', 'empty-brook-f048.rekkisomo.workers.dev/376/251/')
}

export function parseProfile(html: string): PlayerProfile {
    const root = parse(html)
    const ratingImgSrcs = root
        .querySelectorAll('.player_rating_num_block img')
        .map(img => img.getAttribute('src') ?? '')

    const playCount = parseInt(qs(root, '.user_data_play_count .user_data_text').replace(/,/g, ''), 10) || 0
    const versionPlayCount = parseInt(qs(root, '.user_data_current_play_count .user_data_text').replace(/,/g, ''), 10) || 0

    return {
        name: qs(root, '.player_name_in'),
        rating: parseRatingImages(ratingImgSrcs),
        characterImageUrl: absoluteUrl(root.querySelector('.player_chara img')?.getAttribute('src')) || '',
        title: qs(root, '.player_honor_short', 'NEW COMER'),
        playCount,
        versionPlayCount,
        overPower: qs(root, '.player_overpower_text', '00000.00 (00.00%)'),
        classImage: root.querySelector('.player_classemblem_top img')?.getAttribute('src') || 'https://chunithm-net-eng.com/mobile/images/classemblem_medal_01.png',
        lastPlayDate: qs(root, '.player_lastplaydate_text'),
        playerLevel: qs(root, '.player_lv'),
        teamName: qs(root, '.player_team_name')
    }
}

// Player-entered text (name, title, team) often uses full-width glyphs that look
// oversized on Discord. Optionally fold them back to half-width.
function normalizeWidth(p: PlayerProfile): PlayerProfile {
    return {
        ...p,
        name: toHalfWidth(p.name),
        title: toHalfWidth(p.title),
        teamName: toHalfWidth(p.teamName),
    }
}

export async function fetchProfile(clal: string, convertWidth = false): Promise<PlayerProfile> {
    // CHUNITHM-NET rotates its session token per request and only tolerates
    // sequential navigation; concurrent requests bounce one page to /mobile/error/.
    const client = new ChuniClient(clal)
    const html = await client.getPage('/mobile/home/playerData')
    const characterHTML = await client.getPage('/mobile/collection')

    debugLog(`fetchProfile: playerData ${html.length} bytes, collection ${characterHTML.length} bytes`)
    debugLog('fetchProfile: playerData head:', html.slice(0, 300).replace(/\s+/g, ' '))

    const parsed = {...parseProfile(html), characterImageUrl: absoluteUrl(parse(characterHTML).querySelector('.character_image_box img')?.getAttribute('src')) || ''}
    const profile = convertWidth ? normalizeWidth(parsed) : parsed

    if (!profile.name && !profile.lastPlayDate) {
        debugLog('fetchProfile: empty profile parsed (likely unauthenticated or region-blocked page)')
    }

    return profile
}
