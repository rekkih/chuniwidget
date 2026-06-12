import { InvalidOtpError, LoginFailureError, OtpRequiredError } from './errors'

const AUTH_INIT_URL =
    'https://lng-tgk-aime-gw.am-all.net/common_auth/login' +
    '?site_id=chuniex' +
    '&redirect_url=https://chunithm-net-eng.com/mobile/' +
    '&back_url=https://chunithm.sega.com/'

const LOGIN_URL = 'https://lng-tgk-aime-gw.am-all.net/common_auth/login/sid'
const OTP_URL = 'https://lng-tgk-aime-gw.am-all.net/common_auth/login/otpauth'

function parseSetCookies(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    for (const header of headers.getSetCookie()) {
        const eq = header.indexOf('=')
        if (eq === -1) continue
        const name = header.slice(0, eq).trim()
        result[name] = header.slice(eq + 1).split(';')[0].trim()
    }
    return result
}

function cookieHeader(jar: Record<string, string>): string {
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

export async function login(segaId: string, password: string, otp?: string): Promise<string> {
    const initRes = await fetch(AUTH_INIT_URL)
    const jar = parseSetCookies(initRes.headers)

    const loginRes = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(Object.keys(jar).length ? { Cookie: cookieHeader(jar) } : {}),
        },
        body: new URLSearchParams({ retention: '1', sid: segaId, password }),
        redirect: 'manual',
    })

    Object.assign(jar, parseSetCookies(loginRes.headers))
    const location = loginRes.headers.get('location') ?? ''

    if (location.includes('/common_auth/login/otp')) {
        if (!otp) throw new OtpRequiredError()

        const otpRes = await fetch(OTP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Cookie: cookieHeader(jar),
            },
            body: new URLSearchParams({ password: otp }),
            redirect: 'manual',
        })

        Object.assign(jar, parseSetCookies(otpRes.headers))
        const otpLocation = otpRes.headers.get('location') ?? ''

        if (!otpLocation.includes('chunithm-net-eng.com')) {
            throw new InvalidOtpError()
        }
    } else if (!location.includes('chunithm-net-eng.com')) {
        throw new LoginFailureError()
    }

    const clal = jar['clal']
    if (!clal) throw new Error('Login succeeded but no clal cookie was returned')

    return clal
}
