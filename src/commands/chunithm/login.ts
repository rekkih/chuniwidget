import { login } from '@/chunithm-net'
import { buildLoginCommand } from '../common/login'

export const loginCommand = buildLoginCommand({
    gameName: 'CHUNITHM',
    netName: 'CHUNITHM-NET',
    scriptFilename: 'add-widget.js',
    performLogin: login,
})
