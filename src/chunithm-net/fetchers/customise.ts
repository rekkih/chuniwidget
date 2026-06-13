import {parse} from 'node-html-parser'
import type {ChuniClient} from '../client'
import {absoluteUrl} from './playerData'

export interface CustomiseData {
    nameplateUrl: string | null
}

export async function fetchCustomise(client: ChuniClient): Promise<CustomiseData> {
    const html = await client.getPage('/mobile/collection/customise')
    const nameplateUrl = absoluteUrl(parse(html).querySelector('.nameplate_now img')?.getAttribute('src') ?? null)
    return {nameplateUrl}
}
