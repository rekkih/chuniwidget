import { debugLog } from '@/utils'
import { SessionExpiredError } from './errors'

// --- Configuration ---

export interface SegaClientConfig {
    base: string
    siteId: string
    redirectUrl: string
    backUrl: string
    targetHostname: string
}

// --- Cookie utilities ---

type DomainJar = Map<string, Map<string, string>>

export function collectSetCookies(jar: DomainJar, hostname: string, headers: Headers): void {
    for (const header of headers.getSetCookie()) {
        const eq = header.indexOf('=')
        if (eq === -1) continue
        const name = header.slice(0, eq).trim()
        const value = header.slice(eq + 1).split(';')[0].trim()
        if (!jar.has(hostname)) jar.set(hostname, new Map())
        jar.get(hostname)!.set(name, value)
    }
}

export function buildCookieHeader(jar: DomainJar, hostname: string): string {
    const cookies = jar.get(hostname)
    if (!cookies?.size) return ''
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

export function cookiesAsHeader(cookies: Map<string, string>): string {
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

// --- Auth Redirect Chain ---

export async function exchangeClalForSession(
    clal: string,
    config: SegaClientConfig,
): Promise<Map<string, string>> {
    const SEGA_AUTH_HOST = 'lng-tgk-aime-gw.am-all.net'
    const jar: DomainJar = new Map([
        [SEGA_AUTH_HOST, new Map([['clal', clal]])],
    ])

    const SEGA_AUTH_INIT =
        `https://lng-tgk-aime-gw.am-all.net/common_auth/login` +
        `?site_id=${config.siteId}` +
        `&redirect_url=${config.redirectUrl}` +
        `&back_url=${config.backUrl}`

    let url = SEGA_AUTH_INIT

    for (let i = 0; i < 12; i++) {
        const { hostname } = new URL(url)
        const cookieStr = buildCookieHeader(jar, hostname)

        const res = await fetch(url, {
            headers: cookieStr ? { Cookie: cookieStr } : {},
            redirect: 'manual',
        })

        collectSetCookies(jar, hostname, res.headers)

        const location = res.headers.get('location')
        if (!location) {
            const targetCookies = jar.get(config.targetHostname)
            if (!targetCookies?.get('_t')) {
                throw new SessionExpiredError()
            }
            return targetCookies
        }

        url = location.startsWith('http') ? location : new URL(location, url).toString()
    }

    throw new Error('SEGA authentication failed: too many redirects')
}

// --- Base Client ---

export abstract class SegaClient {
    protected _cookies: Map<string, string> | null = null

    constructor(protected readonly clal: string, protected readonly config: SegaClientConfig) { }

    async getCookies(): Promise<Map<string, string>> {
        if (!this._cookies) {
            this._cookies = await exchangeClalForSession(this.clal, this.config)
        }
        return this._cookies
    }

    async getPage(path: string): Promise<string> {
        if (!this._cookies) {
            this._cookies = await exchangeClalForSession(this.clal, this.config)
        }

        const res = await fetch(`${this.config.base}${path}`, {
            headers: { Cookie: cookiesAsHeader(this._cookies) },
            redirect: 'follow',
        })

        debugLog(`getPage ${path}: ${res.status}, final url ${res.url}`)

        const authHost = 'lng-tgk-aime-gw.am-all.net'
        if (new URL(res.url).hostname === authHost) {
            debugLog(`getPage ${path}: bounced to auth host, re-exchanging clal`)
            this._cookies = await exchangeClalForSession(this.clal, this.config)
            const retry = await fetch(`${this.config.base}${path}`, {
                headers: { Cookie: cookiesAsHeader(this._cookies) },
            })
            debugLog(`getPage ${path}: retry ${retry.status}, final url ${retry.url}`)
            return retry.text()
        }

        return res.text()
    }
}
