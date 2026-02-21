// ============================================================
// APA 7 Smart Citation Machine - Server (v2)
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
    try { parsedUrl = new URL(targetUrl); } catch(e) { return reject(new Error('Invalid URL')); }

    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.get({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
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
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ── Extract metadata from raw HTML ──────────────────────────
function extractMeta(html, pageUrl) {
  const get = (patterns) => {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) return match[1].replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").trim();
    }
    return '';
  };

  const title = get([
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
    /<meta[^>]+name="twitter:title"[^>]+content="([^"]+)"/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]);

  const author = get([
    /<meta[^>]+name="author"[^>]+content="([^"]+)"/i,
    /<meta[^>]+property="article:author"[^>]+content="([^"]+)"/i,
    /class="[^"]*author[^"]*"[^>]*>([^<]{3,60})</i,
  ]);

  const date = get([
    /<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i,
    /<meta[^>]+name="date"[^>]+content="([^"]+)"/i,
    /<time[^>]+datetime="([^"]+)"/i,
  ]);

  const siteName = get([
    /<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i,
  ]) || new URL(pageUrl).hostname.replace(/^www\./, '');

  // Parse date into year, month, day
  let year = '', month = '', day = '';
  if (date) {
    const d = new Date(date);
    if (!isNaN(d)) {
      year  = d.getFullYear().toString();
      month = d.toLocaleString('en-US', { month: 'long' });
      day   = d.getDate().toString();
    }
  }

  return { title, author, year, month, day, siteName, url: pageUrl };
}

// ── APA 7 Author Formatting ──────────────────────────────────
function formatAuthors(authorsRaw) {
  if (!authorsRaw || !authorsRaw.trim()) return '';
  // Split on semicolons or " and " or commas not followed by initials
  const parts = authorsRaw.split(/\s*[;&]\s*|\s+and\s+/i).map(a => a.trim()).filter(Boolean);

  const formatted = parts.map(author => {
    if (/^[A-Z][a-z]+,\s*[A-Z]\./.test(author)) return author; // already formatted
    const words = author.trim().split(/\s+/);
    if (words.length === 1) return words[0];
    const last = words[words.length - 1];
    const initials = words.slice(0, -1).map(w => w[0].toUpperCase() + '.').join(' ');
    return `${last}, ${initials}`;
  });

  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  if (formatted.length >= 21) {
    // APA 7: 20 authors, then ..., last author
    return formatted.slice(0, 19).join(', ') + ', . . . ' + formatted[formatted.length - 1];
  }
  return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
}

// ── In-text citation ─────────────────────────────────────────
function buildInText(authorsRaw, year) {
  if (!authorsRaw) return `(${year || 'n.d.'})`;
  const parts = authorsRaw.split(/\s*[;&]\s*|\s+and\s+/i).map(a => a.trim()).filter(Boolean);
  const getLastName = (name) => {
    if (/,/.test(name)) return name.split(',')[0].trim();
    const words = name.trim().split(/\s+/);
    return words[words.length - 1];
  };
  const yr = year || 'n.d.';
  if (parts.length === 1) return `(${getLastName(parts[0])}, ${yr})`;
  if (parts.length === 2) return `(${getLastName(parts[0])} & ${getLastName(parts[1])}, ${yr})`;
  return `(${getLastName(parts[0])} et al., ${yr})`;
}

// ── APA 7 Citation Builder ───────────────────────────────────
function buildCitation(data) {
  const { sourceType, authors, year, month, day, title, journal, volume, issue,
          pages, doi, publisher, siteName, websiteUrl, edition, location } = data;

  const authorStr = formatAuthors(authors) || '[No author]';
  const dateStr = (() => {
    if (!year) return '(n.d.)';
    if (month && day) return `(${year}, ${month} ${day})`;
    if (month) return `(${year}, ${month})`;
    return `(${year})`;
  })();
  const yr = year || 'n.d.';

  let ref = '';

  switch (sourceType) {
    case 'website':
      ref = `${authorStr}. ${dateStr}. <em>${title}</em>. ${siteName || ''}. ${websiteUrl || ''}`;
      break;

    case 'book':
      const edStr = edition ? ` (${edition} ed.)` : '';
      ref = `${authorStr}. (${yr}). <em>${title}</em>${edStr}. ${publisher || ''}.`;
      if (doi) ref += ` https://doi.org/${doi}`;
      break;

    case 'journal':
      const volIssue = volume ? ` <em>${volume}</em>${issue ? `(${issue})` : ''}` : '';
      const pagesStr = pages ? `, ${pages}` : '';
      ref = `${authorStr}. (${yr}). ${title}. <em>${journal}</em>,${volIssue}${pagesStr}.`;
      if (doi) ref += ` https://doi.org/${doi}`;
      break;

    case 'newspaper':
      ref = `${authorStr}. ${dateStr}. ${title}. <em>${journal}</em>.`;
      if (websiteUrl) ref += ` ${websiteUrl}`;
      break;

    case 'youtube':
      ref = `${authorStr}. ${dateStr}. <em>${title}</em> [Video]. YouTube. ${websiteUrl || ''}`;
      break;

    default:
      ref = `${authorStr}. (${yr}). <em>${title}</em>. ${publisher || ''}.`;
  }

  return {
    reference: ref.replace(/\s+\./g, '.').replace(/\.\./g, '.'),
    inText: buildInText(authors, year),
  };
}

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname  = parsedUrl.pathname;

  // Serve HTML
  if (req.method === 'GET' && pathname === '/') {
    fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, html) => {
      if (err) { res.writeHead(500); res.end('Missing index.html'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    return;
  }

  // Collect POST body
  const getBody = () => new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c.toString());
    req.on('end', () => resolve(body));
  });

  // Fetch metadata from URL
  if (req.method === 'POST' && pathname === '/fetch-meta') {
    const body = await getBody();
    const { url: targetUrl } = JSON.parse(body);
    try {
      const html = await fetchHTML(targetUrl);
      const meta = extractMeta(html, targetUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, meta }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // Generate citation
  if (req.method === 'POST' && pathname === '/generate') {
    const body = await getBody();
    const data = JSON.parse(body);
    const result = buildCitation(data);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`✅ Smart Citation Machine running → http://localhost:${PORT}`);
});
