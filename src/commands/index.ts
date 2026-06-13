import type {BotCommand} from '@/types'
import {loginCommand} from './login'
import {refreshCommand} from './refresh'
import {unlinkCommand} from './logout'
import {configCommand} from './config'
import {contactCommand} from './contact'
import {profileGifCommand} from './profileGif'

export const commands: BotCommand[] = [loginCommand, refreshCommand, unlinkCommand, configCommand, contactCommand, profileGifCommand]
