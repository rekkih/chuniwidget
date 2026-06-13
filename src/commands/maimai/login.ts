import { login } from '@/maimai-net'
import { buildLoginCommand } from '../common/login'

export const loginCommand = buildLoginCommand({
    gameName: 'maimai DX',
    netName: 'maimai-net',
    scriptFilename: 'add-widget.js',
    performLogin: login,
})
