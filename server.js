// ============================================================
// APA 7 Smart Citation Machine - Server (v3, fully APA 7 compliant)
// Run: node server.js  →  open http://localhost:3000
// ============================================================

const http  = require('http');
const https = require('https');
const url   = require('url');
const fs    = require('fs');
const path  = require('path');

const PORT = process.env.PORT || 3000;

// ── Fetch raw HTML from a URL ────────────────────────────────
function fetchHTML(targetUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    let parsedUrl;
    try { parsedUrl = new URL(targetUrl); }
    catch(e) { return reject(new Error('Invalid URL')); }

    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.get({
      hostname: parsedUrl.hostname,
      path:     parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':     'text/html,application/xhtml+xml',
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsedUrl.origin}${res.headers.location}`;
        fetchHTML(next, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; if (data.length > 500000) res.destroy(); });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timed out')); });
  });
}

// ── Extract metadata from raw HTML ──────────────────────────
function extractMeta(html, pageUrl) {
  const decode = s => s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

  const get = (patterns) => {
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1] && m[1].trim()) return decode(m[1]);
    }
    return '';
  };

  const title = get([
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{2,200})["']/i,
    /<meta[^>]+content=["']([^"']{2,200})["'][^>]+property=["']og:title["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']{2,200})["']/i,
    /<meta[^>]+content=["']([^"']{2,200})["'][^>]+name=["']twitter:title["']/i,
    /<title[^>]*>([^<]{2,200})<\/title>/i,
  ]);

  const author = get([
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']{2,100})["']/i,
    /<meta[^>]+content=["']([^"']{2,100})["'][^>]+name=["']author["']/i,
    /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']{2,100})["']/i,
    /<meta[^>]+content=["']([^"']{2,100})["'][^>]+property=["']article:author["']/i,
    /"author"\s*:\s*\[\s*\{\s*(?:"@type"\s*:\s*"[^"]*"\s*,\s*)?"name"\s*:\s*"([^"]{2,100})"/i,
    /"author"\s*:\s*\{\s*(?:"@type"\s*:\s*"[^"]*"\s*,\s*)?"name"\s*:\s*"([^"]{2,100})"/i,
    /"author"\s*:\s*"([^"]{2,100})"/i,
    /[Bb]y\s+([A-Z][a-z\-']+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z\-']+)/,
    /rel=["']author["'][^>]*>([A-Z][a-z]+ [A-Z][a-z]+)/,
  ]);

  const date = get([
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
  ]);

  const siteName = get([
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
  ]) || new URL(pageUrl).hostname.replace(/^www\./, '');

  let year = '', month = '', day = '';
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      year  = d.getFullYear().toString();
      month = d.toLocaleString('en-US', { month: 'long' });
      day   = d.getDate().toString();
    }
  }

  return { title, author, year, month, day, siteName, url: pageUrl };
}

// ── Sentence case (APA 7 rule for titles) ───────────────────
// Capitalize only the first word and proper nouns
function toSentenceCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Format authors into APA 7 style: Last, F. M. ────────────
function formatAuthors(authorsRaw) {
  if (!authorsRaw || !authorsRaw.trim()) return '';

  const parts = authorsRaw
    .split(/\s*;\s*|\s+and\s+|\s*&\s*(?=[A-Z])/i)
    .map(a => a.trim())
    .filter(Boolean);

  const formatted = parts.map(author => {
    // Already formatted: Last, F.
    if (/^[A-Za-z\-']+,\s*[A-Z]\./.test(author)) return author;
    const words = author.trim().split(/\s+/);
    if (words.length === 1) return words[0];
    const last     = words[words.length - 1];
    const initials = words.slice(0, -1).map(w => w[0].toUpperCase() + '.').join(' ');
    return `${last}, ${initials}`;
  });

  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;

  // APA 7: 21+ authors → first 19, . . ., last
  if (formatted.length >= 21) {
    return formatted.slice(0, 19).join(', ') + ', . . . ' + formatted[formatted.length - 1];
  }

  return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
}

// ── In-text citation ─────────────────────────────────────────
// APA 7 no-author: use first few words of title
//   - Standalone work (book/website/video) → italicize title
//   - Part of a larger work (article/chapter) → use "quotation marks"
function buildInText(authorsRaw, year, title, sourceType) {
  const yr        = year || 'n.d.';
  const hasAuthor = authorsRaw && authorsRaw.trim();

  if (!hasAuthor) {
    const shortTitle = (title || 'Untitled').split(' ').slice(0, 4).join(' ');
    const standalone = ['book', 'website', 'youtube'].includes(sourceType);
    return standalone
      ? `(<em>${toSentenceCase(shortTitle)}</em>, ${yr})`
      : `("${toSentenceCase(shortTitle)}," ${yr})`;
  }

  const parts = authorsRaw
    .split(/\s*;\s*|\s+and\s+|\s*&\s*(?=[A-Z])/i)
    .map(a => a.trim())
    .filter(Boolean);

  const getLastName = (name) => {
    if (/,/.test(name)) return name.split(',')[0].trim();
    const words = name.trim().split(/\s+/);
    return words[words.length - 1];
  };

  if (parts.length === 1) return `(${getLastName(parts[0])}, ${yr})`;
  if (parts.length === 2) return `(${getLastName(parts[0])} & ${getLastName(parts[1])}, ${yr})`;
  return `(${getLastName(parts[0])} et al., ${yr})`;
}

// ── APA 7 Citation Builder ───────────────────────────────────
function buildCitation(data) {
  const {
    sourceType, authors, year, month, day,
    title, journal, volume, issue, pages,
    doi, publisher, siteName, websiteUrl, edition,
  } = data;

  const hasAuthor  = authors && authors.trim();
  const authorStr  = hasAuthor ? formatAuthors(authors) : null;
  const titleSC    = toSentenceCase(title || 'Untitled');

  // Date strings
  const dateParens = !year          ? '(n.d.)'
                   : month && day   ? `(${year}, ${month} ${day})`
                   : month          ? `(${year}, ${month})`
                                    : `(${year})`;
  const yearParens = year ? `(${year})` : '(n.d.)';

  // DOI — APA 7: present as full URL, no trailing period
  const doiUrl = doi
    ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, '').trim()}`
    : '';
  const webUrl = (websiteUrl || '').trim();

  let ref = '';

  // ── Website ──────────────────────────────────────────────────
  // With author:    Author. (Year, Month Day). Title. Site Name. URL
  // Without author: Title. (Year, Month Day). Site Name. URL
  if (sourceType === 'website') {
    const site = siteName ? `${siteName.trim()}.` : '';
    ref = hasAuthor
      ? `${authorStr}. ${dateParens}. <em>${titleSC}</em>. ${site} ${webUrl}`
      : `<em>${titleSC}</em>. ${dateParens}. ${site} ${webUrl}`;
    // No period after URL
    ref = ref.replace(/\s+/g, ' ').trimEnd();
  }

  // ── Book ─────────────────────────────────────────────────────
  // With author:    Author. (Year). Title (ed.). Publisher.
  // Without author: Title (ed.). (Year). Publisher.
  // DOI/URL at end, no period after
  else if (sourceType === 'book') {
    const edPart = edition ? ` (${edition} ed.)` : '';
    const pub    = publisher ? `${publisher.trim()}.` : '';
    ref = hasAuthor
      ? `${authorStr}. ${yearParens}. <em>${titleSC}</em>${edPart}. ${pub}`
      : `<em>${titleSC}</em>${edPart}. ${yearParens}. ${pub}`;
    ref = ref.replace(/\s+/g, ' ').trimEnd().replace(/\.$/, '');
    ref = doiUrl ? `${ref} ${doiUrl}` : `${ref}.`;
  }

  // ── Journal Article ──────────────────────────────────────────
  // With author:    Author. (Year). Title. Journal, vol(issue), pages. DOI
  // Without author: Title. (Year). Journal, vol(issue), pages. DOI
  // Volume = italicized; issue = NOT italicized, in parentheses
  else if (sourceType === 'journal') {
    const jName     = journal ? `<em>${journal}</em>` : '';
    const volPart   = volume  ? `, <em>${volume}</em>` : '';
    const issuePart = issue   ? `(${issue})`           : '';
    const pagesPart = pages   ? `, ${pages}`            : '';
    ref = hasAuthor
      ? `${authorStr}. ${yearParens}. ${titleSC}. ${jName}${volPart}${issuePart}${pagesPart}.`
      : `${titleSC}. ${yearParens}. ${jName}${volPart}${issuePart}${pagesPart}.`;
    ref = ref.replace(/\s+/g, ' ').trimEnd().replace(/\.$/, '');
    ref = doiUrl ? `${ref} ${doiUrl}` : `${ref}.`;
  }

  // ── Newspaper ────────────────────────────────────────────────
  // With author:    Author. (Year, Month Day). Title. Newspaper. URL
  // Without author: Title. (Year, Month Day). Newspaper. URL
  else if (sourceType === 'newspaper') {
    const paper = journal ? `<em>${journal}</em>.` : '';
    ref = hasAuthor
      ? `${authorStr}. ${dateParens}. ${titleSC}. ${paper}`
      : `${titleSC}. ${dateParens}. ${paper}`;
    ref = ref.replace(/\s+/g, ' ').trimEnd().replace(/\.$/, '');
    ref = webUrl ? `${ref} ${webUrl}` : `${ref}.`;
  }

  // ── YouTube Video ────────────────────────────────────────────
  // With author:    Author. (Year, Month Day). Title [Video]. YouTube. URL
  // Without author: Title [Video]. (Year, Month Day). YouTube. URL
  else if (sourceType === 'youtube') {
    ref = hasAuthor
      ? `${authorStr}. ${dateParens}. <em>${titleSC}</em> [Video]. YouTube. ${webUrl}`
      : `<em>${titleSC}</em> [Video]. ${dateParens}. YouTube. ${webUrl}`;
    ref = ref.replace(/\s+/g, ' ').trimEnd();
  }

  else {
    ref = hasAuthor
      ? `${authorStr}. ${yearParens}. <em>${titleSC}</em>. ${publisher || ''}.`
      : `<em>${titleSC}</em>. ${yearParens}. ${publisher || ''}.`;
  }

  return {
    reference: ref.trim(),
    inText:    buildInText(authors, year, title, sourceType),
  };
}

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

  const sendJSON = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const getBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c.toString(); if (body.length > 100000) req.destroy(); });
    req.on('end',  () => resolve(body));
    req.on('error', reject);
  });

  // Serve HTML page
  if (req.method === 'GET' && pathname === '/') {
    fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, html) => {
      if (err) { res.writeHead(500); res.end('Missing index.html'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    return;
  }

  // Scrape URL for metadata
  if (req.method === 'POST' && pathname === '/fetch-meta') {
    getBody()
      .then(body => JSON.parse(body))
      .then(({ url: targetUrl }) => fetchHTML(targetUrl).then(html => extractMeta(html, targetUrl)))
      .then(meta  => sendJSON({ ok: true,  meta }))
      .catch(e    => sendJSON({ ok: false, error: e.message }));
    return;
  }

  // Generate APA 7 citation
  if (req.method === 'POST' && pathname === '/generate') {
    getBody()
      .then(body   => JSON.parse(body))
      .then(data   => sendJSON({ ok: true, ...buildCitation(data) }))
      .catch(e     => sendJSON({ ok: false, error: e.message }));
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`✅ APA 7 Citation Machine → http://localhost:${PORT}`);
});
