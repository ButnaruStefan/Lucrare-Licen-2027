/**
 * Paznicul adreselor (protectie SSRF).
 *
 * Scannerul deschide adrese primite de la utilizatori. Fara protectie, cineva ar putea cere
 * scanarea unor adrese interne (ex. http://localhost:5432, http://192.168.1.1 sau serviciul de
 * metadate cloud 169.254.169.254) si ar folosi serverul nostru ca sa ajunga unde nu are voie.
 *
 * O adresa e acceptata doar daca:
 *   - foloseste http:// sau https://, fara utilizator si parola in adresa;
 *   - numele de domeniu se rezolva (DNS) DOAR la adrese IP publice.
 * Exceptie: originile trecute explicit in `allowedLocalOrigins` (ex. site-urile de antrenament
 * de pe http://localhost:4000), folosite doar in dezvoltare si teste.
 *
 * Verificarea se face si in API (inainte de a crea scanarea), si in browser, pentru FIECARE
 * cerere: pagina principala, redirectionari, imagini, scripturi, iframe-uri.
 *
 * Limita cunoscuta: browserul face propria rezolvare DNS, deci un atacator care controleaza un
 * server DNS ar putea raspunde diferit la a doua interogare (DNS rebinding). Intr-o instalare
 * publica, protectia trebuie completata cu filtrare la nivel de retea (firewall pentru worker).
 */
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/** Intervalele de adrese IP interzise: retele private, locale, rezervate sau speciale. */
const BLOCKED_RANGES: Array<[string, number, 'ipv4' | 'ipv6']> = [
  ['0.0.0.0', 8, 'ipv4'], // "aceasta retea"
  ['10.0.0.0', 8, 'ipv4'], // retea privata
  ['100.64.0.0', 10, 'ipv4'], // retea partajata a furnizorilor (CGNAT)
  ['127.0.0.0', 8, 'ipv4'], // loopback (localhost)
  ['169.254.0.0', 16, 'ipv4'], // link-local, inclusiv metadatele cloud 169.254.169.254
  ['172.16.0.0', 12, 'ipv4'], // retea privata
  ['192.0.0.0', 24, 'ipv4'], // rezervat IETF
  ['192.0.2.0', 24, 'ipv4'], // documentatie
  ['192.88.99.0', 24, 'ipv4'], // releu 6to4 (depreciat)
  ['192.168.0.0', 16, 'ipv4'], // retea privata
  ['198.18.0.0', 15, 'ipv4'], // teste de performanta
  ['198.51.100.0', 24, 'ipv4'], // documentatie
  ['203.0.113.0', 24, 'ipv4'], // documentatie
  ['224.0.0.0', 4, 'ipv4'], // multicast
  ['240.0.0.0', 4, 'ipv4'], // rezervat + broadcast
  ['::', 128, 'ipv6'], // adresa nespecificata
  ['::1', 128, 'ipv6'], // loopback IPv6
  ['::ffff:0:0', 96, 'ipv6'], // IPv4 scris ca IPv6 (ex. ::ffff:127.0.0.1)
  ['64:ff9b::', 96, 'ipv6'], // traducere IPv6 -> IPv4 (NAT64)
  ['100::', 64, 'ipv6'], // de aruncat
  ['2001::', 32, 'ipv6'], // Teredo
  ['2001:db8::', 32, 'ipv6'], // documentatie
  ['fc00::', 7, 'ipv6'], // retea privata IPv6
  ['fe80::', 10, 'ipv6'], // link-local IPv6
  ['ff00::', 8, 'ipv6'], // multicast IPv6
];

// Doua liste separate: BlockList din Node verifica o adresa IPv4 si fata de regulile IPv6
// de tip ::ffff:0:0/96, deci intr-o lista comuna regula aceea ar bloca TOATE adresele IPv4.
const blockedIpv4 = new BlockList();
const blockedIpv6 = new BlockList();
for (const [address, prefix, family] of BLOCKED_RANGES) {
  (family === 'ipv4' ? blockedIpv4 : blockedIpv6).addSubnet(address, prefix, family);
}

/** True daca IP-ul e intr-un interval interzis (sau nu e un IP valid). */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return blockedIpv4.check(ip, 'ipv4');
  if (family === 6) return blockedIpv6.check(ip, 'ipv6');
  return true;
}

/** Motivele pentru care o adresa poate fi respinsa. */
export type UnsafeUrlReason =
  'INVALID_URL' | 'SCHEME_NOT_ALLOWED' | 'CREDENTIALS_IN_URL' | 'DNS_FAILED' | 'PRIVATE_ADDRESS';

export type UrlCheckResult =
  { ok: true; url: URL } | { ok: false; reason: UnsafeUrlReason; message: string };

/** Rezolva un nume de domeniu in adrese IP. Poate fi inlocuit in teste. */
export type HostResolver = (hostname: string) => Promise<string[]>;

export const systemResolver: HostResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
};

export interface UrlGuardOptions {
  /** Originile locale permise explicit, ex. ["http://localhost:4000"]. */
  allowedLocalOrigins?: readonly string[];
  resolve?: HostResolver;
}

function reject(reason: UnsafeUrlReason, message: string): UrlCheckResult {
  return { ok: false, reason, message };
}

/** Verifica o adresa si spune daca poate fi accesata de scanner. */
export async function checkUrl(
  raw: string,
  options: UrlGuardOptions = {},
): Promise<UrlCheckResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return reject('INVALID_URL', 'Adresa nu este validă.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return reject('SCHEME_NOT_ALLOWED', 'Sunt permise doar adrese http:// sau https://.');
  }
  if (url.username || url.password) {
    return reject('CREDENTIALS_IN_URL', 'Adresa nu poate conține utilizator sau parolă.');
  }
  if (options.allowedLocalOrigins?.includes(url.origin)) {
    return { ok: true, url };
  }

  // Parantezele drepte apar doar la IPv6 scris direct in adresa: http://[::1]/
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = await (options.resolve ?? systemResolver)(host);
    } catch {
      return reject('DNS_FAILED', `Domeniul ${host} nu a putut fi găsit.`);
    }
    if (addresses.length === 0) {
      return reject('DNS_FAILED', `Domeniul ${host} nu a putut fi găsit.`);
    }
  }

  // Daca ORICARE dintre adrese e interzisa, respingem: altfel atacatorul ar putea amesteca
  // o adresa publica cu una interna in acelasi raspuns DNS.
  if (addresses.some(isBlockedIp)) {
    return reject(
      'PRIVATE_ADDRESS',
      'Adresa duce către o rețea internă sau rezervată și nu poate fi scanată.',
    );
  }
  return { ok: true, url };
}

/**
 * Varianta folosita in browser, pentru fiecare cerere a paginii: tine minte rezultatul pentru
 * fiecare origine, ca sa nu repete interogarea DNS pentru zeci de imagini de pe acelasi domeniu.
 */
export function createRequestGuard(options: UrlGuardOptions = {}) {
  const cache = new Map<string, Promise<UrlCheckResult>>();
  return (raw: string): Promise<UrlCheckResult> => {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return Promise.resolve(reject('INVALID_URL', 'Adresa nu este validă.'));
    }
    // Utilizatorul/parola nu fac parte din origine, deci le verificam inainte de cache.
    if (parsed.username || parsed.password) {
      return Promise.resolve(
        reject('CREDENTIALS_IN_URL', 'Adresa nu poate conține utilizator sau parolă.'),
      );
    }
    const origin = parsed.origin;
    let result = cache.get(origin);
    if (!result) {
      result = checkUrl(raw, options);
      cache.set(origin, result);
    }
    return result;
  };
}

export type RequestGuard = ReturnType<typeof createRequestGuard>;
