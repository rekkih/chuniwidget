// =============================================================================
// Add widget to your Discord profile
//
// What this script does, step by step:
//   1. Reads your Discord session token and user ID from Discord's own memory.
//      These are already stored in your browser by discord.com - we are not
//      sending them anywhere new.
//   2. Fetches your current profile widget list so we don't remove anything.
//   3. Adds the widget to that list.
//   4. Sends the updated list back to Discord's API.
//
// This script only ever talks to discord.com (/api/v9/...).
// It does not make requests to any external server.
// It does not read, store, or transmit your password or personal data.
// =============================================================================

(async () => {

    // The ID of the Discord application. Hard-coded so you can verify it.
    const APP_ID = "{{APP_ID}}";


    // ---------------------------------------------------------------------------
    // Discord's web app is built with webpack and keeps all its modules in a
    // global array called webpackChunkdiscord_app. We push a temporary module
    // that iterates over the already-loaded modules looking for two things:
    //   - getToken()       -> your session token (same one your browser uses)
    //   - getCurrentUser() -> your Discord user ID
    //
    // We immediately pop our temporary module back out after reading them.
    // ---------------------------------------------------------------------------

    let token, userId;

    window.webpackChunkdiscord_app.push([[Symbol()], {}, require => {
        for (const module of Object.values(require.c)) {
            try {
                if (!module.exports || module.exports === window) continue;

                const exports = module.exports;

                // Some modules export the helpers directly at the top level...
                if (!token && exports.getToken) token = exports.getToken();
                if (!userId && exports.getCurrentUser?.()?.id) userId = exports.getCurrentUser().id;

                // ...others nest them one level deeper under named keys.
                for (const key in exports) {
                    const value = exports[key];
                    if (!value || value[Symbol.toStringTag] === 'IntlMessagesProxy') continue;
                    if (!token && value.getToken) token = value.getToken();
                    if (!userId && value.getCurrentUser?.()?.id) userId = value.getCurrentUser().id;
                }

                if (token && userId) break;
            } catch {
                // Some modules throw when accessed; just skip them.
            }
        }
    }]);

    window.webpackChunkdiscord_app.pop(); // clean up our temporary module

    if (!token || !userId) {
        return console.error(
            '%c[Yakuon] Could not read your session!!! Are you logged in on discord.com?',
            'color:#f87171;font-weight:600',
        );
    }


    // ---------------------------------------------------------------------------
    // Discord lets you have multiple widgets on your profile. We fetch the
    // current list first so we can append to it rather than replace it.
    // If this fetch fails for any reason we just start with an empty list.
    // ---------------------------------------------------------------------------

    const headers = { Authorization: token, 'Content-Type': 'application/json' };

    let existingWidgets = [];
    try {
        const profile = await fetch(`/api/v9/users/${userId}/profile`, { headers }).then(r => r.json());
        existingWidgets = profile.widgets ?? [];
    } catch { }

    // Nothing to do if the widget is already there.
    if (existingWidgets.some(w => w.data?.application_id === APP_ID)) {
        return console.log(
            '%c[Yakuon] CHUNITHM widget is already on your profile.',
            'color:#fde047;font-weight:600',
        );
    }


    // ---------------------------------------------------------------------------
    // We PUT the new list to /api/v9/users/@me/widgets.
    // The CHUNITHM widget goes first; everything you had before is preserved.
    // ---------------------------------------------------------------------------

    const updatedWidgets = [
        { data: { type: 'application', application_id: APP_ID } },
        ...existingWidgets,
    ];

    // Helper so we can re-use the same request after a 2FA challenge (see below).
    async function putWidgets(extraHeaders = {}) {
        return fetch('/api/v9/users/@me/widgets', {
            method: 'PUT',
            headers: { ...headers, ...extraHeaders },
            body: JSON.stringify({ widgets: updatedWidgets }),
        });
    }

    let response = await putWidgets();

    if (response.ok) {
        return console.log(
            `%c[Yakuon] Done! CHUNITHM widget added. ${existingWidgets.length} existing widget(s) kept. Refresh your profile.`,
            'color:#4ade80;font-weight:600',
        );
    }


    // ---------------------------------------------------------------------------
    // Handle errors from Discord.
    // ---------------------------------------------------------------------------

    let errorBody = null;
    try { errorBody = await response.json(); } catch { }


    // --- 2FA required (error code 60003) ---
    //
    // Discord sometimes requires a fresh two-factor authentication challenge
    // before it allows profile changes. If that happens:
    //   a) We prompt you for your 6-digit TOTP code (or a backup code).
    //   b) We submit it to Discord's MFA endpoint to get a one-time token.
    //   c) We retry the widget PUT with that token in a special header.

    if (response.status === 401 && errorBody?.code === 60003 && errorBody?.mfa?.ticket) {
        const availableMethods = (errorBody.mfa.methods ?? []).map(m => m.type ?? m).join(', ') || 'totp';
        console.warn(
            `%c[Yakuon] Discord is asking for 2FA verification (${availableMethods}).`,
            'color:#fde047;font-weight:600',
        );

        const rawCode = prompt('[Yakuon] Enter your 6-digit authenticator code, or a backup code (format: xxxxx-xxxxx):');
        if (!rawCode) {
            return console.error('%c[Yakuon] Cancelled as there was no code entered.', 'color:#f87171;font-weight:600');
        }

        const cleanCode = rawCode.replace(/[^0-9a-z-]/gi, '');
        const mfaType = cleanCode.includes('-') ? 'backup' : 'totp';

        // Submit the code to Discord to receive a short-lived MFA authorisation token.
        const mfaResponse = await fetch('/api/v9/mfa/finish', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ticket: errorBody.mfa.ticket,
                mfa_type: mfaType,
                data: cleanCode,
            }),
        });

        const mfaResult = await mfaResponse.json().catch(() => ({}));

        if (!mfaResponse.ok || !mfaResult.token) {
            return console.error(
                '%c[Yakuon] 2FA failed: ' + (mfaResult.message ?? mfaResponse.status),
                'color:#f87171;font-weight:600',
            );
        }

        // Retry with the MFA token attached.
        response = await putWidgets({ 'X-Discord-MFA-Authorization': mfaResult.token });

        if (response.ok) {
            return console.log(
                '%c[Yakuon] Done! Widget added after 2FA. Refresh your profile.',
                'color:#4ade80;font-weight:600',
            );
        }

        errorBody = await response.json().catch(() => null);
        return console.error(
            '%c[Yakuon] Failed after 2FA: ' + (errorBody?.message ?? response.status),
            'color:#f87171;font-weight:600',
        );
    }


    // --- Generic 401 (error code 40001) ---
    //
    // This can mean one of three things, checked in order:
    //   A) You haven't connected this bot to your Discord profile yet.
    //      Run /login in Discord and complete the "Connect Discord Profile" step first.
    //   B) The bot has no published widget config yet. Contact the bot owner.
    //   C) Your MFA session cookie is stale. Fix: open Settings -> My Account ->
    //      Two-Factor Authentication -> "View Backup Codes", enter your password
    //      when prompted, then cancel. This refreshes the cookie. Re-run
    //      this script within 5 minutes.

    if (response.status === 401 && errorBody?.code === 40001) {
        // Check whether the app has a published widget config.
        // Must send the user token — this endpoint is not publicly accessible.
        const configRes = await fetch(`/api/v9/applications/${APP_ID}/widget-configs`, { headers })
            .catch(() => null);
        const widgetConfig = configRes?.ok ? await configRes.json().catch(() => null) : null;

        if (configRes?.ok && Array.isArray(widgetConfig) && widgetConfig.length === 0) {
            return console.error(
                '%c[Yakuon] The app has no published widget config yet. Contact the bot owner.',
                'color:#f87171;font-weight:600',
            );
        }

        // If the config check itself was unauthorized, or we got a config back,
        // the most likely cause is that the Discord OAuth step hasn't been completed
        // for this specific bot. A stale MFA session is the secondary possibility.
        return console.error(
            '%c[Yakuon] Authorization failed (40001). Most likely causes:\n\n' +
            '1. You have not yet linked your account with this bot.\n' +
            '   Run /login in Discord and complete the "Connect Discord Profile" OAuth step.\n\n' +
            '2. Your MFA session cookie is stale (less common).\n' +
            '   Fix: Settings -> My Account -> Two-Factor Authentication -> "View Backup Codes"\n' +
            '   -> enter your password -> cancel. Then re-run within 5 minutes.',
            'color:#fde047;font-weight:600',
        );
    }


    // --- Catch-all for any other error ---
    console.error(
        '%c[Yakuon] Unexpected error: ' + (errorBody?.message ?? response.status),
        'color:#f87171;font-weight:600',
    );

})();
