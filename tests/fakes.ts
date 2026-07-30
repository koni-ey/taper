import type { Page } from '@playwright/test';

/**
 * Builds the base64 hash used by Taper to serialize a tape into the URL.
 * Mirrors Tape.svelte: btoa(unescape(encodeURIComponent(serialized))).
 * For ASCII content this is equivalent to base64 of the UTF-8 bytes.
 */
export function encodeTape(songUrls: string[]): string {
    const serialized = songUrls.map((u) => `song: ${u}`).join('\n\n---\n\n');
    return Buffer.from(serialized, 'utf-8').toString('base64');
}

/**
 * The fake SoundCloud Widget SDK, injected into the page before the app runs.
 * It replaces the real cross-origin widget with a controllable in-page stub that
 * fires READY / PLAY / PLAY_PROGRESS / FINISH events just like the real one, and
 * logs every construct/ready/play/pause to window.__scLog for assertions.
 */
function fakeSoundCloudSdk(): string {
    return `(() => {
      window.__scLog = [];
      const Events = { READY: 'ready', PLAY: 'play', PAUSE: 'pause', PLAY_PROGRESS: 'playProgress', FINISH: 'finish', ERROR: 'error' };
      function log(entry) { window.__scLog.push(Object.assign({ t: performance.now() }, entry)); }
      function makeWidget(iframe) {
        const src = iframe.src || '';
        const url = decodeURIComponent(src);
        // Distinct durations per track so we can assert reset + correct total.
        const durationMs = url.includes('track-b') ? 130000 : 200000;
        const title = url.includes('track-b') ? 'Track B' : 'Track A';
        const listeners = {};
        let position = 0;
        let timer = null;
        log({ type: 'construct', src });
        function emit(ev, data) { (listeners[ev] || []).forEach((cb) => cb(data)); }
        const widget = {
          bind(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); },
          unbind(ev) { delete listeners[ev]; },
          getCurrentSound(cb) { cb({ title, user: { username: 'Artist' }, artwork_url: '' }); },
          getDuration(cb) { cb(durationMs); },
          getPosition(cb) { cb(position); },
          seekTo(ms) { position = ms; },
          play() {
            log({ type: 'play', src });
            if (timer) return;
            emit(Events.PLAY);
            timer = setInterval(() => {
              position += 500;
              if (position >= durationMs) { position = durationMs; clearInterval(timer); timer = null; emit(Events.FINISH); return; }
              emit(Events.PLAY_PROGRESS, { currentPosition: position, relativePosition: position / durationMs, loadedProgress: 1 });
            }, 20);
          },
          pause() { log({ type: 'pause', src }); if (timer) { clearInterval(timer); timer = null; } emit(Events.PAUSE); },
        };
        // Simulate the async iframe handshake before READY fires.
        setTimeout(() => { log({ type: 'ready', src }); emit(Events.READY); }, 120);
        return widget;
      }
      const SC = function () {};
      SC.Widget = function (iframe) { return makeWidget(iframe); };
      SC.Widget.Events = Events;
      window.SC = SC;
    })();`;
}

/**
 * Minimal YouTube IFrame API stub. The progress/mobile tests use SoundCloud and
 * Spotify tapes, so YouTube just needs to exist and signal readiness.
 */
function fakeYoutubeSdk(): string {
    return `(() => {
      window.YT = { Player: function () { return {}; }, PlayerState: { ENDED: 0 } };
    })();`;
}

/**
 * Fake Spotify Web Playback SDK. Records activateElement() and playback calls so
 * the mobile-unlock behavior can be asserted.
 */
function fakeSpotifySdk(): string {
    return `(() => {
      window.__spotifyLog = [];
      function log(entry) { window.__spotifyLog.push(Object.assign({ t: performance.now() }, entry)); }
      window.Spotify = {
        Player: function (opts) {
          const listeners = {};
          const player = {
            _opts: opts,
            addListener(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); },
            removeListener(ev) { delete listeners[ev]; },
            connect() {
              log({ type: 'connect' });
              setTimeout(() => { (listeners['ready'] || []).forEach((cb) => cb({ device_id: 'fake-device-123' })); }, 20);
              return Promise.resolve(true);
            },
            disconnect() {},
            activateElement() { log({ type: 'activateElement' }); return Promise.resolve(); },
            resume() { log({ type: 'resume' }); return Promise.resolve(); },
            pause() { log({ type: 'pause' }); return Promise.resolve(); },
            seek() { return Promise.resolve(); },
            getCurrentState() { return Promise.resolve(null); },
          };
          return player;
        },
      };
    })();`;
}

interface SetupOptions {
    spotifyToken?: string;
}

/**
 * Wires up all network interception + SDK injection so the app runs fully offline
 * against controllable fakes. Must be called before navigating to the page.
 */
export async function setupFakes(page: Page, opts: SetupOptions = {}): Promise<void> {
    // Inject the fake SDK globals before any app code executes.
    await page.addInitScript(fakeSoundCloudSdk());
    await page.addInitScript(fakeYoutubeSdk());
    await page.addInitScript(fakeSpotifySdk());

    if (opts.spotifyToken) {
        await page.addInitScript((token) => {
            localStorage.setItem('spotify_access_token', token as string);
        }, opts.spotifyToken);
    }

    // The three provider SDK <script> tags: return empty JS so their onload fires
    // (globals are already defined via addInitScript above).
    await page.route('https://w.soundcloud.com/player/api.js', (r) => r.fulfill({ contentType: 'application/javascript', body: '/* fake sc */' }));
    await page.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();' }));
    await page.route('https://sdk.scdn.co/spotify-player.js', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.onSpotifyWebPlaybackSDKReady && window.onSpotifyWebPlaybackSDKReady();' }));

    // The hidden SoundCloud player iframe: serve a tiny stub page.
    await page.route(/w\.soundcloud\.com\/player\/\?/, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>sc</title>' }));

    // Metadata / auth endpoints: respond quickly so nothing hangs on the network.
    await page.route(/api\.spotify\.com\/v1\/me$/, (r) => r.fulfill({ contentType: 'application/json', body: '{"id":"fake-user"}' }));
    await page.route(/api\.spotify\.com\/v1\/me\/player\/play/, (r) => {
        r.fulfill({ status: 204, body: '' });
    });
    await page.route(/api\.spotify\.com\/v1\/tracks\//, (r) => r.fulfill({ contentType: 'application/json', body: '{"name":"Fake","artists":[{"name":"Artist"}],"album":{"images":[]}}' }));
    await page.route(/soundcloud\.com\/oembed/, (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
    await page.route(/noembed\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
    await page.route(/api\.song\.link/, (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
    await page.route(/open\.spotify\.com\/oembed/, (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
}
