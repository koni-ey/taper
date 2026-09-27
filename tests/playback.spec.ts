import { expect, test } from '@playwright/test';

const first = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const second = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';

test.beforeEach(async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({
        contentType: 'application/javascript',
        body: `window.YT = { Player: class {
            constructor(id, options) {
                this.options = options;
                this.state = -1;
                this.iframe = document.createElement('iframe');
                this.iframe.id = id;
                (window.testPlayers ||= {})[id] = this;
                document.getElementById(id).replaceWith(this.iframe);
                window.setTimeout(() => options.events.onReady({ target: this }), 50);
            }
            getIframe() { return this.iframe; }
            getVideoData() { return { title: 'Mock video' }; }
            getCurrentTime() { return 0; }
            getDuration() { return 120; }
            getPlayerState() { return this.state; }
            seekTo() {}
            playVideo() {
                if (window.blockYoutube) {
                    this.options.events.onAutoplayBlocked();
                    return;
                }
                this.state = 1;
                this.options.events.onStateChange({ data: 1 });
            }
            pauseVideo() {
                this.state = 2;
                this.options.events.onStateChange({ data: 2 });
            }
        }};
        window.onYouTubeIframeAPIReady();`
    }));
    await page.route('https://w.soundcloud.com/player/api.js', route => route.fulfill({
        contentType: 'application/javascript', body: ''
    }));
    await page.route('https://sdk.scdn.co/spotify-player.js', route => route.fulfill({
        contentType: 'application/javascript', body: ''
    }));
    await page.route('https://noembed.com/**', route => route.fulfill({
        contentType: 'application/json', body: '{"title":"Mock video"}'
    }));
});

test('YouTube starts, pauses, resumes and exposes blocked playback', async ({ page }) => {
    const tape = `song: ${first}\n\n---\n\nsong: ${second}`;
    await page.goto('/#' + Buffer.from(tape, 'utf8').toString('base64'));

    await expect(page.locator('iframe[id^="yt-player-"]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

    await page.evaluate(() => { (window as any).blockYoutube = true; });
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('alert')).toContainText('Safari blocked YouTube playback');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open in YouTube' })).toHaveAttribute('href', first);

    await page.evaluate(() => { (window as any).blockYoutube = false; });
    // Native iframe controls can start playback even after an API request was blocked.
    await page.evaluate(() => {
        const player = Object.values((window as any).testPlayers)[0] as any;
        player.playVideo();
    });
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // iOS can suspend the iframe without delivering its paused event.
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        (Object.values((window as any).testPlayers)[0] as any).state = 2;
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Safari stopped YouTube in the background');
});

test('skipping before the first iframe is ready does not play the old track', async ({ page }) => {
    const tape = `song: ${first}\n\n---\n\nsong: ${second}`;
    await page.goto('/#' + Buffer.from(tape, 'utf8').toString('base64'));
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.waitForTimeout(200);
    const states = await page.evaluate(() => Object.values((window as any).testPlayers).map((p: any) => p.getPlayerState()));
    expect(states.filter(state => state === 1)).toHaveLength(1);
});

test('skipping to an initialized YouTube embed switches the visible player', async ({ page }) => {
    const tape = `song: ${first}\n\n---\n\nsong: ${second}`;
    await page.goto('/#' + Buffer.from(tape, 'utf8').toString('base64'));
    await expect(page.locator('iframe[id^="yt-player-"]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(page.locator('iframe[id^="yt-player-"]:visible')).toHaveCount(1);
    await expect(page.getByText(second, { exact: true })).toBeVisible();
});
