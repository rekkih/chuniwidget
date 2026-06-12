import 'dotenv/config'
import {Client, GatewayIntentBits, REST, Routes} from 'discord.js'
import type {ButtonStep, CommandStep, ModalStep, SelectStep} from './types'
import {commands} from './commands'
import {ensureWidgetConfig} from './discord/widgetConfig'
import {startOAuthServer} from './oauth2/server'
import {startPeriodicRefresh} from './discord/profileRefresh'

const token = process.env.DISCORD_TOKEN
const clientId = process.env.DISCORD_CLIENT_ID

if (!token || !clientId) {
    console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment')
    process.exit(1)
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

const client = new Client({intents: [GatewayIntentBits.Guilds]})

client.once('clientReady', async () => {
    startOAuthServer(client)
    console.log(`[bot] Logged in as ${client.user!.tag}`)

    const rest = new REST().setToken(token)
    await rest.put(Routes.applicationCommands(clientId), {
        body: commands.map(c => c.definition.toJSON()),
    })
    console.log('[bot] Slash commands registered globally')

    try {
        await ensureWidgetConfig()
    } catch (err) {
        console.error('[bot] Widget config setup failed (non-fatal):', err)
    }

    startPeriodicRefresh()
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
