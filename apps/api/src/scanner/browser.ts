/**
 * Pornirea browserului folosit de scanner.
 *
 * Canalul ales (variabila BROWSER_CHANNEL):
 *   - "chrome"   -> Google Chrome instalat pe calculator (necesar pe macOS 13, unde Playwright
 *                   nu mai ofera Chromium propriu);
 *   - "msedge"   -> Microsoft Edge instalat (util pe Windows);
 *   - "chromium" -> Chromium descarcat de Playwright (`npx playwright install chromium`).
 */
import { chromium, type Browser } from 'playwright';

export const BROWSER_CHANNELS = ['chrome', 'msedge', 'chromium'] as const;
export type BrowserChannel = (typeof BROWSER_CHANNELS)[number];

export async function launchBrowser(channel: BrowserChannel): Promise<Browser> {
  return chromium.launch({
    headless: true,
    channel: channel === 'chromium' ? undefined : channel,
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
