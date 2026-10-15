/**
 * Teste pentru paznicul adreselor (protectie SSRF).
 *
 * Rezolvarea DNS e inlocuita cu una falsa, ca testele sa nu depinda de internet si sa putem
 * simula un domeniu care "duce" spre o adresa interna.
 */
import { describe, expect, it } from 'vitest';
import { checkUrl, createRequestGuard, isBlockedIp } from '../src/safety/url-guard';

const PUBLIC_IP = '93.184.216.34';

/** Rezolvare DNS falsa: fiecare domeniu primeste adresele din tabel. */
function fakeResolver(table: Record<string, string[]>) {
  return async (hostname: string) => {
    const addresses = table[hostname];
    if (!addresses) throw new Error('ENOTFOUND');
    return addresses;
  };
}

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // metadatele cloud
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1', // IPv4 intern scris ca IPv6
    '::ffff:7f00:1', // aceeasi adresa, forma hexazecimala
    'nu-e-ip',
  ])('blocheaza %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each([PUBLIC_IP, '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111'])('permite %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe('checkUrl', () => {
  const resolve = fakeResolver({
    'exemplu.ro': [PUBLIC_IP],
    'intern.exemplu.ro': ['10.0.0.5'],
    'amestecat.exemplu.ro': [PUBLIC_IP, '127.0.0.1'],
  });

  it('accepta un domeniu public', async () => {
    const result = await checkUrl('https://exemplu.ro/pagina', { resolve });
    expect(result.ok).toBe(true);
  });

  it.each([
    ['schema ftp', 'ftp://exemplu.ro', 'SCHEME_NOT_ALLOWED'],
    ['schema file', 'file:///etc/passwd', 'SCHEME_NOT_ALLOWED'],
    ['javascript:', 'javascript:alert(1)', 'SCHEME_NOT_ALLOWED'],
    ['utilizator si parola', 'https://admin:x@exemplu.ro', 'CREDENTIALS_IN_URL'],
    ['adresa invalida', 'nu e adresa', 'INVALID_URL'],
    ['localhost', 'http://localhost:5432', 'PRIVATE_ADDRESS'],
    ['IP privat direct', 'http://192.168.0.10/admin', 'PRIVATE_ADDRESS'],
    ['metadate cloud', 'http://169.254.169.254/latest/meta-data/', 'PRIVATE_ADDRESS'],
    ['IPv6 loopback', 'http://[::1]:3000/', 'PRIVATE_ADDRESS'],
    ['IP scris ca numar', 'http://2130706433/', 'PRIVATE_ADDRESS'], // = 127.0.0.1
    ['domeniu care duce spre retea interna', 'https://intern.exemplu.ro', 'PRIVATE_ADDRESS'],
    [
      'domeniu cu o adresa publica si una interna',
      'https://amestecat.exemplu.ro',
      'PRIVATE_ADDRESS',
    ],
    ['domeniu inexistent', 'https://nu-exista.exemplu.ro', 'DNS_FAILED'],
  ])('respinge %s', async (_caz, url, reason) => {
    const fakeLocalhost = fakeResolver({ localhost: ['127.0.0.1'] });
    const result = await checkUrl(url, {
      resolve: async (h) => (h === 'localhost' ? fakeLocalhost(h) : resolve(h)),
    });
    expect(result).toMatchObject({ ok: false, reason });
  });

  it('accepta o origine locala doar daca e permisa explicit (site-urile de antrenament)', async () => {
    const options = { allowedLocalOrigins: ['http://localhost:4000'], resolve };
    expect((await checkUrl('http://localhost:4000/broken/', options)).ok).toBe(true);
    // Alt port pe localhost ramane blocat
    expect(
      await checkUrl('http://localhost:5432/', {
        ...options,
        resolve: async () => ['127.0.0.1'],
      }),
    ).toMatchObject({ ok: false, reason: 'PRIVATE_ADDRESS' });
  });
});

describe('createRequestGuard', () => {
  it('interogheaza DNS o singura data pentru aceeasi origine', async () => {
    let calls = 0;
    const guard = createRequestGuard({
      resolve: async () => {
        calls += 1;
        return [PUBLIC_IP];
      },
    });
    await guard('https://exemplu.ro/a.png');
    await guard('https://exemplu.ro/b.css');
    await guard('https://exemplu.ro/c.js');
    expect(calls).toBe(1);
  });

  it('respinge utilizator si parola chiar daca originea e deja verificata', async () => {
    const guard = createRequestGuard({ resolve: async () => [PUBLIC_IP] });
    expect((await guard('https://exemplu.ro/')).ok).toBe(true);
    expect(await guard('https://user:parola@exemplu.ro/')).toMatchObject({
      ok: false,
      reason: 'CREDENTIALS_IN_URL',
    });
  });
});
