import { parse } from 'node-html-parser'
import type { MaimaiClient } from '../client'

export interface PlayerData {
    name: string
    rating: string
    ratingBaseUrl: string | null
    title: string
    titleType: string
    iconUrl: string | null
    courseRankUrl: string | null
    classRankUrl: string | null
    starCount: number
    charaUrl: string | null
}

export interface PlayerMetadata {
    versionPlayCount: number
    totalPlayCount: number
    miles: string
}

export interface PlayerRecords {
    lastPlayDate: string
}

function extractTitleType(classAttr: string): string {
    const m = classAttr.match(/trophy_(\w+)/)
    return m ? m[1] : 'Normal'
}

function absoluteUrl(src: string | undefined | null): string | null {
    if (!src) return null
    if (src.startsWith('http')) return src
    if (src.startsWith('//')) return 'https:' + src
    return 'https://maimaidx-eng.com' + src
}

export function parsePlayerData(html: string): PlayerData {
    const root = parse(html)

    const basicBlock = root.querySelector('.basic_block')

    const iconUrl = absoluteUrl(basicBlock?.querySelector('img.w_112')?.getAttribute('src'))

    const titleBlock = basicBlock?.querySelector('.trophy_block')
    const title = titleBlock?.querySelector('.trophy_inner_block span')?.text?.trim() ?? ''
    const titleType = extractTitleType(titleBlock?.getAttribute('class') ?? '')

    const name = basicBlock?.querySelector('.name_block')?.text?.trim() ?? ''
    const rating = basicBlock?.querySelector('.rating_block')?.text?.trim() ?? '0'
    const ratingBaseUrl = absoluteUrl(basicBlock?.querySelector('img.h_30')?.getAttribute('src'))

    const h35imgs = basicBlock?.querySelectorAll('img.h_35') ?? []
    const courseRankUrl = absoluteUrl(h35imgs[0]?.getAttribute('src'))
    const classRankUrl = absoluteUrl(h35imgs[1]?.getAttribute('src'))

    const starText = basicBlock?.querySelector('.f_14')?.text ?? ''
    const starMatch = starText.match(/[×x×](\d+)/)
    const starCount = starMatch ? parseInt(starMatch[1], 10) : 0

    const charaUrl = absoluteUrl(
        root.querySelector('img.w_120.m_t_10.f_r')?.getAttribute('src')
    )

    return {
        name,
        rating,
        ratingBaseUrl,
        title,
        titleType,
        iconUrl,
        courseRankUrl,
        classRankUrl,
        starCount,
        charaUrl,
    }
}

export function parsePlayerMetadata(html: string): PlayerMetadata {
    const root = parse(html)

    const playCountText = root.querySelector('.m_5.m_b_5.t_r.f_12')?.text ?? ''
    const parseCount = (pattern: RegExp) => {
        const m = playCountText.match(pattern)
        return m ? parseInt(m[1], 10) : 0
    }

    const miles = root.querySelector('.mile_block.p_t_7')?.text?.trim() ?? ''

    return {
        versionPlayCount: parseCount(/current version\uff1a(\d+)/i),
        totalPlayCount: parseCount(/total play count\uff1a(\d+)/i),
        miles,
    }
}

export async function fetchPlayerData(client: MaimaiClient): Promise<PlayerData> {
    const html = await client.getPage('/home/')
    return parsePlayerData(html)
}

export async function fetchPlayerMetadata(client: MaimaiClient): Promise<PlayerMetadata> {
    const html = await client.getPage('/playerData/')
    return parsePlayerMetadata(html)
}

export function parsePlayerRecords(html: string): PlayerRecords {
    const root = parse(html)
    const lastPlayDate = root.querySelectorAll('span.v_b')[1]?.text?.trim() ?? ''
    return { lastPlayDate }
}

export async function fetchPlayerRecords(client: MaimaiClient): Promise<PlayerRecords> {
    const html = await client.getPage('/record/')
    return parsePlayerRecords(html)
}
