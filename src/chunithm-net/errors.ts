export class ChuniNetError extends Error {
    constructor(public readonly code: number, message: string) {
        super(message)
        this.name = 'ChuniNetError'
    }
}

export class LoginFailureError extends ChuniNetError {
    constructor() {
        super(100101, 'Invalid username or password')
    }
}

export class OtpRequiredError extends ChuniNetError {
    constructor() {
        super(100102, 'Two-factor authentication is required')
    }
}

export class InvalidOtpError extends ChuniNetError {
    constructor() {
        super(100103, 'Invalid two-factor authentication code')
    }
}
