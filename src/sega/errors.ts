export class SegaNetError extends Error {
    constructor(public readonly code: number, message: string) {
        super(message)
        this.name = 'SegaNetError'
    }
}

export class LoginFailureError extends SegaNetError {
    constructor() {
        super(100101, 'Invalid username or password')
    }
}

export class OtpRequiredError extends SegaNetError {
    constructor() {
        super(100102, 'Two-factor authentication is required')
    }
}

export class InvalidOtpError extends SegaNetError {
    constructor() {
        super(100103, 'Invalid two-factor authentication code')
    }
}

export class SessionExpiredError extends Error {
    constructor() {
        super('SEGA session expired — re-authentication required')
        this.name = 'SessionExpiredError'
    }
}
