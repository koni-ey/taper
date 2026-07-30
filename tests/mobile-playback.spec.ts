import { test, expect } from '@playwright/test';
import { setupFakes, encodeTape } from './fakes';

const SC_A = 'https://soundcloud.com/artist/track-a';
const SPOTIFY_A = 'https://open.spotify.com/track/4omurqpm7aWH9VVz2Ii4yO';

/**
 * Bug 2: On mobile, the first tap did not start playback — users had to tap
 * play, pause, then play again. Root causes:
 *   - SoundCloud: when the widget instance wasn't ready, play() ran in an async
 *     .then() OUTSIDE the user gesture, so mobile blocked it. The widget must be
 *     pre-initialized so play() runs synchronously inside the tap.
 *   - Spotify: the Web Playback SDK's hidden media element must be unlocked with
 *     activateElement() inside the gesture.
 *
 * These tests run under the mobile-chromium project (touch emulation).
 */

test.describe('Mobile SoundCloud playback (single tap)', () => {
    test('first tap starts playback synchronously (no play/pause/play)', async ({ page }) => {
        await setupFakes(page);
        await page.goto('/#' + encodeTape([SC_A]));

        // Wait for the widget to be pre-initialized (READY logged) so the instance
        // exists before we tap — this is what allows synchronous play().
        await expect
            .poll(async () => page.evaluate(() => (window as any).__scLog?.some((e: any) => e.type === 'ready')), { timeout: 8000 })
            .toBe(true);

        // Single tap on the song card.
        await page.locator('[data-testid="song-card"]').first().tap();

        // play() must have been called exactly once as a result of the single tap.
        await expect
            .poll(async () => page.evaluate(() => (window as any).__scLog?.filter((e: any) => e.type === 'play').length), { timeout: 5000 })
            .toBe(1);

        // The UI should reflect playing state and progress should advance.
        await expect(page.getByTestId('total-time')).toHaveText('3:20', { timeout: 5000 });
        await expect
            .poll(async () => page.getByTestId('current-time').textContent(), { timeout: 5000 })
            .not.toBe('0:00');
    });

    test('play() happens without an intervening pause (regression guard)', async ({ page }) => {
        await setupFakes(page);
        await page.goto('/#' + encodeTape([SC_A]));

        await expect
            .poll(async () => page.evaluate(() => (window as any).__scLog?.some((e: any) => e.type === 'ready')), { timeout: 8000 })
            .toBe(true);

        await page.locator('[data-testid="song-card"]').first().tap();

        await expect
            .poll(async () => page.evaluate(() => (window as any).__scLog?.filter((e: any) => e.type === 'play').length), { timeout: 5000 })
            .toBe(1);

        // The buggy behavior required play -> pause -> play. Assert there is no
        // pause recorded before the first successful play.
        const log = await page.evaluate(() => (window as any).__scLog as Array<{ type: string }>);
        const firstPlayIdx = log.findIndex((e) => e.type === 'play');
        const pauseBeforePlay = log.slice(0, firstPlayIdx).some((e) => e.type === 'pause');
        expect(pauseBeforePlay).toBe(false);
    });
});

test.describe('Mobile Spotify playback (single tap)', () => {
    test('activateElement() is called when starting playback (mobile audio unlock)', async ({ page }) => {
        await setupFakes(page, { spotifyToken: 'fake-token' });
        await page.goto('/#' + encodeTape([SPOTIFY_A]));

        // Wait until the Spotify SDK player has been created and connected. This
        // implies the token was verified (card is enabled) and the player object
        // exists so activateElement() can run inside the tap.
        await expect
            .poll(async () => page.evaluate(() => (window as any).__spotifyLog?.some((e: any) => e.type === 'connect')), { timeout: 10000 })
            .toBe(true);
        // And wait for the ready event (device id) so the play request can fire too.
        await expect(page.getByText('Connected')).toBeVisible({ timeout: 10000 });

        await page.locator('[data-testid="song-card"]').first().click();

        // activateElement must have been invoked to unlock mobile audio.
        await expect
            .poll(async () => page.evaluate(() => (window as any).__spotifyLog?.some((e: any) => e.type === 'activateElement')), { timeout: 5000 })
            .toBe(true);
    });
});
