import {Client} from 'discord.js'
import {consumeState} from './state'
import {getUser, setExternalId} from '@/store'
import {pushProfile} from '@/discord/profilePush'
import type {DescriptionMode} from '@/discord/descriptionModes'
import {CHUNITHM} from '@/chunithm-net'
import {DISCORD_API} from '@/discord/client'

const CONNECTED_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Connected</title>
  <style>
    body { background:#1e1f22; color:#dbdee1; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
           display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
    .card { background:#2b2d31; border-radius:12px; padding:32px; text-align:center; box-shadow:0 8px 32px rgba(0,0,0,.4); }
    h1 { font-size:22px; font-weight:700; color:#fff; margin:0 0 8px; }
    p  { color:#949ba4; font-size:14px; margin:0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connected!</h1>
    <p>Check your Discord DMs for the next step.</p>
  </div>
</body>
</html>`

const SNIPPET_TEMPLATE = await Bun.file(
    new URL('../../scripts/add-chunithm-widget.js', import.meta.url),
).text()

export function buildSnippet(appId: string): string {
    return SNIPPET_TEMPLATE.replace('"{{APP_ID}}"', JSON.stringify(appId))
}

async function exchangeCode(code: string): Promise<{ accessToken: string; discordUserId: string }> {
    const res = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID!,
            client_secret: process.env.DISCORD_CLIENT_SECRET!,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.OAUTH2_REDIRECT_URI!,
        }),
    })
    if (!res.ok) throw new Error(`Token exchange ${res.status}: ${await res.text()}`)
    const data = await res.json() as { access_token: string }

    const meRes = await fetch(`${DISCORD_API}/oauth2/@me`, {
        headers: {Authorization: `Bearer ${data.access_token}`},
    })
    if (!meRes.ok) throw new Error(`Could not resolve user from token: ${await meRes.text()}`)
    const me = await meRes.json() as { user: { id: string } }

    return {accessToken: data.access_token, discordUserId: me.user.id}
}


export function startOAuthServer(client: Client): void {
    const port = Number(process.env.OAUTH2_PORT ?? 3001)

    Bun.serve({
        port,
        async fetch(req) {
            const url = new URL(req.url)
            if (url.pathname !== '/oauth2/callback') {
                return new Response('Not found', {status: 404})
            }

            const error = url.searchParams.get('error')
            if (error) {
                const desc = url.searchParams.get('error_description') ?? error
                console.error(`[oauth2] Discord error: ${error}: ${desc}`)
                return new Response('Authorization failed. Please try /login again.', {
                    status: 400,
                    headers: {'Content-Type': 'text/plain'},
                })
            }

            const code = url.searchParams.get('code')
            const state = url.searchParams.get('state')
            if (!code || !state) return new Response('Missing code or state', {status: 400})

            const discordUserId = consumeState(state)
            if (!discordUserId) return new Response('Invalid or expired state', {status: 400})

            try {
                const {discordUserId: resolvedId} = await exchangeCode(code)

                const user = await getUser(discordUserId)
                if (user) {
                    const externalId = user.externalId ?? user.segaId
                    const {profile, collection} = await CHUNITHM.actAs(user.discordId).select({
                        profile: true,
                        collection: true,
                    })
                    await pushProfile(resolvedId, externalId, {...profile, characterImageUrl: collection.characterUrl}, user.descriptionMode as DescriptionMode)
                    await setExternalId(resolvedId, externalId)

                    const snippet = buildSnippet(process.env.DISCORD_CLIENT_ID!)
                    try {
                        const dmUser = await client.users.fetch(resolvedId)
                        await dmUser.send({
                            content: [
                                '## CHUNITHM profile linked!',
                                'One last step: open **discord.com** in your browser, press `F12` -> **Console**, paste the file below, and hit Enter. If you\'re on a custom Discord client, you can use the devtools in that as well.',
                                '',
                                '**This is a temporary workaround** as Discord doesn\'t list custom app widgets on their UI just yet.',
                                '',
                                '> :warning: **Never paste code into your browser console unless you trust its source.** This snippet is unobfuscated. You can (and should) read through it before running it. It only calls Discord\'s own API to add the widget to your profile.',
                            ].join('\n'),
                            files: [{
                                attachment: Buffer.from(snippet, 'utf8'),
                                name: 'add-chunithm-widget.js',
                            }],
                        })
                        await dmUser.send({
                            content: [
                                'I\'ll keep watch of your CHUNITHM profile and automatically update after every few sets. However, the more you play in a day, the longer I\'ll wait as to not overload the servers.',
                                '',
                                'If you want to manage your CHUNITHM profile via Discord, we recommend looking into [chuni penguin bot](https://chuni-penguin.beerpsi.cc/).',
                                '',
                                'That\'s all!'
                            ].join('\n'),
                        })
                    } catch (dmErr) {
                        console.warn('[oauth2] Could not DM user (DMs may be closed):', dmErr)
                    }
                }
            } catch (err: any) {
                const isMismatch = err?.message?.includes('APPLICATION_IDENTITY_PROVIDER_USER_ID_MISMATCH')
                if (isMismatch) {
                    return new Response(
                        'Your Discord profile is already linked to a different SEGA ID.\n' +
                        'To re-link: go to Discord Settings -> Connections, remove this app, then run /login again.',
                        {status: 409, headers: {'Content-Type': 'text/plain'}},
                    )
                }
                console.error('[oauth2] Callback error:', err)
                return new Response('Authorization failed. Please try /login again.', {
                    status: 500,
                    headers: {'Content-Type': 'text/plain'},
                })
            }

            return new Response(CONNECTED_PAGE, {headers: {'Content-Type': 'text/html'}})
        },
    })

    console.log(`[oauth2] Callback server listening on :${port}`)
}
