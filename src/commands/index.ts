import {ApplicationIntegrationType, InteractionContextType} from 'discord.js'
import type {BotCommand} from '@/types'
import {loginCommand} from './login'
import {refreshCommand} from './refresh'
import {unlinkCommand} from './logout'
import {configCommand} from './config'
import {contactCommand} from './contact'
import {profileGifCommand} from './profileGif'

const ALL_COMMANDS = [loginCommand, refreshCommand, unlinkCommand, configCommand, contactCommand, profileGifCommand]

for (const cmd of ALL_COMMANDS) {
    cmd.definition
        .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
        .setContexts([InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
}

export const commands: BotCommand[] = ALL_COMMANDS
