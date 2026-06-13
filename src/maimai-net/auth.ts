import { login as segaLogin, SegaAuthConfig } from '@/sega/auth'
import { LoginFailureError, OtpRequiredError, InvalidOtpError } from '@/sega/errors'

const config: SegaAuthConfig = {
    siteId: 'maimaidxex',
    redirectUrl: 'https://maimaidx-eng.com/maimai-mobile/',
    backUrl: 'https://maimai.sega.com/',
    targetHostname: 'maimaidx-eng.com',
}

export { LoginFailureError, OtpRequiredError, InvalidOtpError }

export async function login(segaId: string, password: string, otp?: string): Promise<string> {
    return segaLogin(segaId, password, otp, config)
}
