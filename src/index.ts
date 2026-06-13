import 'dotenv/config'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, GatewayIntentBits, REST, Routes } from 'discord.js'
import type { ButtonStep, CommandStep, ModalStep, SelectStep } from './types'
import { commands } from './commands'
import { ensureWidgetConfig as chuniWidgetConfig } from './discord/chunithm/widgetConfig'
import { startPeriodicRefresh as chuniStartRefresh } from './discord/chunithm/profileRefresh'
import { pushProfile as chuniPushProfile } from './discord/chunithm/profilePush'
import { ensureWidgetConfig as maimaiWidgetConfig } from './discord/maimai/widgetConfig'
import { startPeriodicRefresh as maimaiStartRefresh } from './discord/maimai/profileRefresh'
import { pushProfile as maimaiPushProfile } from './discord/maimai/profilePush'
import { CHUNITHM } from './chunithm-net'
import { MAIMAI } from './maimai-net'
import { startOAuthServer, type OAuthCallbackConfig } from './oauth2/server'
import { startStateCleanup } from './oauth2/state'
import { pauseSync } from './store'
import type { DescriptionMode as ChuniDescriptionMode } from './discord/chunithm/descriptionModes'
import type { DescriptionMode as MaimaiDescriptionMode } from './discord/maimai/descriptionModes'

const token = process.env.DISCORD_TOKEN
const clientId = process.env.DISCORD_CLIENT_ID

if (!token || !clientId || !process.env.DISCORD_CLIENT_SECRET || !process.env.OAUTH2_REDIRECT_URI) {
    console.error('Missing required env vars: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, OAUTH2_REDIRECT_URI')
    process.exit(1)
}

const game = (process.env.GAME ?? 'chunithm').toLowerCase()
console.log(`[bot] Game mode: ${game}`)

const ensureWidgetConfig = game === 'maimai' ? maimaiWidgetConfig : chuniWidgetConfig
const startPeriodicRefresh = game === 'maimai' ? maimaiStartRefresh : chuniStartRefresh

const oauthConfig: OAuthCallbackConfig = game === 'maimai'
    ? {
        gameName: 'maimai DX',
        scriptFilename: 'add-widget.js',
        async fetchAndPush(user, resolvedId, externalId) {
            const { profile, metadata, records } = await MAIMAI.actAs(user.discordId).select({ profile: true, metadata: true, records: true })
            await maimaiPushProfile(resolvedId, externalId, profile, user.descriptionMode as MaimaiDescriptionMode, metadata, records)
        },
    }
    : {
        gameName: 'CHUNITHM',
        scriptFilename: 'add-widget.js',
        async fetchAndPush(user, resolvedId, externalId) {
            const { profile, collection } = await CHUNITHM.actAs(user.discordId).select({ profile: true, collection: true })
            await chuniPushProfile(resolvedId, externalId, { ...profile, characterImageUrl: collection.characterUrl }, user.descriptionMode as ChuniDescriptionMode)
        },
    }

const commandMap = new Map<string, CommandStep>()
const buttonMap = new Map<string, ButtonStep>()
const modalMap = new Map<string, ModalStep>()
const selectMap = new Map<string, SelectStep>()

for (const cmd of commands) {
    for (const step of cmd.steps) {
        switch (step.type) {
            case 'command':
                commandMap.set(cmd.definition.name, step)
                break
            case 'button':
                buttonMap.set(step.id, step)
                break
            case 'modal':
                modalMap.set(step.id, step)
                break
            case 'select':
                selectMap.set(step.id, step)
                break
        }
    }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once('clientReady', async () => {
    startOAuthServer(client, oauthConfig)
    console.log(`[bot] Logged in as ${client.user!.tag}`)

    const rest = new REST().setToken(token)
    await rest.put(Routes.applicationCommands(clientId), {
        body: commands.map(c => c.definition.toJSON()),
    })
    console.log('[bot] Slash commands registered globally')

    const onSessionExpired = async (discordId: string) => {
        try {
            await pauseSync(discordId)
            const user = await client.users.fetch(discordId)
            await user.send({
                content: [
                    '## Your SEGA session has expired',
                    'Your login token is no longer valid. Click below to re-enter your SEGA ID and password.',
                ].join('\n'),
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('login:reauth_open_modal')
                            .setLabel('Re-authenticate')
                            .setStyle(ButtonStyle.Primary),
                    ),
                ],
            })
        } catch (err) {
            console.error(`[refresh] Could not DM ${discordId}:`, err)
        }
    }

    startPeriodicRefresh(onSessionExpired)
    startStateCleanup()
})

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            await commandMap.get(interaction.commandName)?.run(interaction)
        } else if (interaction.isButton()) {
            await buttonMap.get(interaction.customId)?.run(interaction)
        } else if (interaction.isModalSubmit()) {
            await modalMap.get(interaction.customId)?.run(interaction)
        } else if (interaction.isStringSelectMenu()) {
            await selectMap.get(interaction.customId)?.run(interaction)
        }
    } catch (err) {
        console.error('[bot] Unhandled interaction error:', err)
    }
})

client.login(token)
