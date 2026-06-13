import { SegaNetError as BaseSegaNetError } from '@/sega/errors'

export class MaimaiNetError extends BaseSegaNetError {
    constructor(code: number, message: string) {
        super(code, message)
        this.name = 'MaimaiNetError'
    }
}

export { LoginFailureError, OtpRequiredError, InvalidOtpError } from '@/sega/errors'
