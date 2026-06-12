import type {BotCommand} from '@/types'
import {loginCommand} from './login'
import {refreshCommand} from './refresh'
import {unlinkCommand} from './logout'
import {configCommand} from './config'

export const commands: BotCommand[] = [loginCommand, refreshCommand, unlinkCommand, configCommand]
