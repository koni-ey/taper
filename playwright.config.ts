import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Taper's playback tests.
 * Boots the Vite dev server and runs the app against injected fake provider SDKs
 * (see tests/fakes.ts) so playback logic can be verified fully offline.
 */
export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:5199',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'desktop-chromium',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /soundcloud-progress\.spec\.ts/,
        },
        {
            // Emulates a mobile browser (touch + small viewport) to exercise the
            // mobile autoplay-unlock code paths.
            name: 'mobile-chromium',
            use: { ...devices['Pixel 5'] },
            testMatch: /(mobile-playback|playback)\.spec\.ts/,
        },
    ],
    webServer: {
        command: 'npx vite --port 5199 --strictPort --host 127.0.0.1',
        url: 'http://127.0.0.1:5199',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
