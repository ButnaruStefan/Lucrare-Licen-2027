/**
 * Pornirea browserului folosit de scanner.
 *
 * Canalul ales (variabila BROWSER_CHANNEL):
 *   - "chrome"   -> Google Chrome instalat pe calculator (necesar pe macOS 13, unde Playwright
 *                   nu mai ofera Chromium propriu);
 *   - "msedge"   -> Microsoft Edge instalat (util pe Windows);
 *   - "chromium" -> Chromium descarcat de Playwright (`npx playwright install chromium`).
 *
 * `createBrowserManager` e folosit de worker: porneste browserul la nevoie (cu limita de timp)
 * si il poate abandona daca s-a blocat, fara sa astepte la nesfarsit inchiderea lui.
 */
import { chromium, type Browser } from 'playwright';
import type { Logger } from '../lib/logger';
import type { BrowserManager } from '../scans/worker-loop';

/** Cat asteptam, cel mult, pornirea browserului. */
export const BROWSER_LAUNCH_TIMEOUT_MS = 30_000;

/** Cat asteptam, cel mult, inchiderea unui browser blocat. */
export const BROWSER_CLOSE_TIMEOUT_MS = 10_000;

export const BROWSER_CHANNELS = ['chrome', 'msedge', 'chromium'] as const;
export type BrowserChannel = (typeof BROWSER_CHANNELS)[number];

export async function launchBrowser(channel: BrowserChannel): Promise<Browser> {
  return chromium.launch({
    headless: true,
    channel: channel === 'chromium' ? undefined : channel,
    timeout: BROWSER_LAUNCH_TIMEOUT_MS,
  });
}

/** Versiunea browserului, in forma pastrata in baza de date (ex. "Chrome 155.0.8059.40"). */
export function describeBrowser(browser: Browser, channel: BrowserChannel): string {
  const names: Record<BrowserChannel, string> = {
    chrome: 'Chrome',
    msedge: 'Edge',
    chromium: 'Chromium',
  };
  return `${names[channel]} ${browser.version()}`;
}

/** Browserul worker-ului: pornit la nevoie, repornit dupa o blocare. */
export function createBrowserManager(channel: BrowserChannel, logger: Logger): BrowserManager {
  let current: { browser: Browser; version: string } | null = null;

  return {
    async ensure() {
      if (current?.browser.isConnected()) return current;
      if (current) await this.reset();
      const browser = await launchBrowser(channel);
      current = { browser, version: describeBrowser(browser, channel) };
      logger.info(`Browser pornit (${current.version})`);
      return current;
    },
    async reset() {
      const old = current;
      current = null;
      if (!old) return;
      // Un browser blocat poate sa nu raspunda nici la inchidere: nu asteptam la nesfarsit.
      const closed = await Promise.race([
        old.browser.close().then(
          () => true,
          () => true,
        ),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), BROWSER_CLOSE_TIMEOUT_MS)),
      ]);
      if (!closed) logger.warn('Browserul vechi nu s-a inchis la timp; il abandonez');
    },
  };
}
