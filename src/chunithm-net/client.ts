import { SegaClient, SegaClientConfig } from '@/sega/base'

const config: SegaClientConfig = {
    base: 'https://chunithm-net-eng.com',
    siteId: 'chuniex',
    redirectUrl: 'https://chunithm-net-eng.com/mobile/',
    backUrl: 'https://chunithm.sega.com/',
    targetHostname: 'chunithm-net-eng.com',
}

export class ChuniClient extends SegaClient {
    constructor(clal: string) {
        super(clal, config)
    }
}
