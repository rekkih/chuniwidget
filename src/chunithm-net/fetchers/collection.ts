import {parse} from 'node-html-parser'
import type {ChuniClient} from '../client'
import {absoluteUrl} from './playerData'

export interface CollectionData {
    characterUrl: string
}

export async function fetchCollection(client: ChuniClient): Promise<CollectionData> {
    const html = await client.getPage('/mobile/collection')
    const characterUrl = absoluteUrl(parse(html).querySelector('.character_image_box img')?.getAttribute('src')) ?? ''
    return {characterUrl}
}
