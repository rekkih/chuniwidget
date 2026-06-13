import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'
import type { BotCommand } from '@/types'
import { unlinkCommand } from './common/logout'
import { contactCommand } from './common/contact'
import { loginCommand as chuniLogin } from './chunithm/login'
import { configCommand as chuniConfig } from './chunithm/config'
import { refreshCommand as chuniRefresh } from './chunithm/refresh'
import { profileGifCommand } from './chunithm/profileGif'
import { loginCommand as maimaiLogin } from './maimai/login'
import { configCommand as maimaiConfig } from './maimai/config'
import { refreshCommand as maimaiRefresh } from './maimai/refresh'

const game = (process.env.GAME ?? 'chunithm').toLowerCase()

const gameCommands: BotCommand[] = game === 'maimai'
    ? [maimaiLogin, maimaiConfig, maimaiRefresh]
    : [chuniLogin, chuniConfig, chuniRefresh, profileGifCommand]

const ALL_COMMANDS = [...gameCommands, unlinkCommand, contactCommand]

for (const cmd of ALL_COMMANDS) {
    cmd.definition
        .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
        .setContexts([InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
}

export const commands: BotCommand[] = ALL_COMMANDS
