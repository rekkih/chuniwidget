import { SegaClient, SegaClientConfig } from '@/sega/base'

const config: SegaClientConfig = {
    base: 'https://maimaidx-eng.com/maimai-mobile',
    siteId: 'maimaidxex',
    redirectUrl: 'https://maimaidx-eng.com/maimai-mobile/',
    backUrl: 'https://maimai.sega.com/',
    targetHostname: 'maimaidx-eng.com',
}

export class MaimaiClient extends SegaClient {
    constructor(clal: string) {
        super(clal, config)
    }
}
