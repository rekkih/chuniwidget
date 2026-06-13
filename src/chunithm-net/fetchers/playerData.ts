import {parse} from 'node-html-parser'
import type {ChuniClient} from '../client'
import {qs} from '../dom'

export interface PlayerData {
    name: string
    rating: string
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

export function absoluteUrl(src: string | undefined | null): string | null {
    if (!src) return null
    return src.replace('chunithm-net-eng.com/', 'chuwidgetimg.rek.lol/360/263/1/')
}

export function parsePlayerData(html: string): PlayerData {
    const root = parse(html)
    const ratingImgSrcs = root
        .querySelectorAll('.player_rating_num_block img')
        .map(img => img.getAttribute('src') ?? '')

    const playCount = parseInt(qs(root, '.user_data_play_count .user_data_text').replace(/,/g, ''), 10) || 0
    const versionPlayCount = parseInt(qs(root, '.user_data_current_play_count .user_data_text').replace(/,/g, ''), 10) || 0

    return {
        name: qs(root, '.player_name_in'),
        rating: parseRatingImages(ratingImgSrcs),
        title: qs(root, '.player_honor_short', 'NEW COMER'),
        playCount,
        versionPlayCount,
        overPower: qs(root, '.player_overpower_text', '00000.00 (00.00%)'),
        classImage: root.querySelector('.player_classemblem_top img')?.getAttribute('src') || 'https://chunithm-net-eng.com/mobile/images/classemblem_medal_01.png',
        lastPlayDate: qs(root, '.player_lastplaydate_text'),
        playerLevel: qs(root, '.player_lv'),
        teamName: qs(root, '.player_team_name'),
    }
}

export async function fetchPlayerData(client: ChuniClient): Promise<PlayerData> {
    const html = await client.getPage('/mobile/home/playerData')
    return parsePlayerData(html)
}
