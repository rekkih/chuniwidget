const CHUNI_BASE     = 'https://chunithm-net-eng.com'
const SEGA_AUTH_HOST = 'lng-tgk-aime-gw.am-all.net'
const SEGA_AUTH_INIT =
    'https://lng-tgk-aime-gw.am-all.net/common_auth/login' +
    '?site_id=chuniex' +
    '&redirect_url=https://chunithm-net-eng.com/mobile/' +
    '&back_url=https://chunithm.sega.com/'

type DomainJar = Map<string, Map<string, string>>

function collectSetCookies(jar: DomainJar, hostname: string, headers: Headers): void {
    for (const header of headers.getSetCookie()) {
        const eq = header.indexOf('=')
        if (eq === -1) continue
        const name  = header.slice(0, eq).trim()
        const value = header.slice(eq + 1).split(';')[0].trim()
        if (!jar.has(hostname)) jar.set(hostname, new Map())
        jar.get(hostname)!.set(name, value)
    }
}

function buildCookieHeader(jar: DomainJar, hostname: string): string {
    const cookies = jar.get(hostname)
    if (!cookies?.size) return ''
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function exchangeClalForSession(clal: string): Promise<Map<string, string>> {
    const jar: DomainJar = new Map([
        [SEGA_AUTH_HOST, new Map([['clal', clal]])],
    ])

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
            const chuniCookies = jar.get('chunithm-net-eng.com')
            if (!chuniCookies?.get('_t')) {
                throw new Error('Auth redirect chain ended but no _t cookie was set')
            }
            return chuniCookies
        }

        url = location.startsWith('http') ? location : new URL(location, url).toString()
    }

    throw new Error('CHUNITHM-NET authentication failed: too many redirects')
}

function cookiesAsHeader(cookies: Map<string, string>): string {
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

export class ChuniClient {
    private _cookies: Map<string, string> | null = null

    constructor(private readonly clal: string) {}

    async getPage(path: string): Promise<string> {
        if (!this._cookies) {
            this._cookies = await exchangeClalForSession(this.clal)
        }

        const res = await fetch(`${CHUNI_BASE}${path}`, {
            headers: { Cookie: cookiesAsHeader(this._cookies) },
            redirect: 'follow',
        })

        if (new URL(res.url).hostname === SEGA_AUTH_HOST) {
            this._cookies = await exchangeClalForSession(this.clal)
            const retry = await fetch(`${CHUNI_BASE}${path}`, {
                headers: { Cookie: cookiesAsHeader(this._cookies) },
            })
            return retry.text()
        }

        return res.text()
    }
}
