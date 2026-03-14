// api/fetch-meta.js
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const killTimer = setTimeout(() => {
    if (!res.headersSent) {
      res.json({ ok: false, error: 'Could not fetch page — fill in fields manually' });
    }
  }, 7000);

  if (req.method !== 'POST') {
    clearTimeout(killTimer);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { url: targetUrl } = req.body || {};
  if (!targetUrl) {
    clearTimeout(killTimer);
    return res.status(400).json({ ok: false, error: 'Missing URL' });
  }

  try { new URL(targetUrl); } catch (e) {
    clearTimeout(killTimer);
    return res.json({ ok: false, error: 'Invalid URL' });
  }

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    const html = await response.text();
    clearTimeout(killTimer);
    const meta = extractMeta(html, targetUrl);
    return res.json({ ok: true, meta });

  } catch (e) {
    clearTimeout(killTimer);
    if (!res.headersSent) {
      return res.json({ ok: false, error: 'Could not fetch page — fill in fields manually' });
    }
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function isUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

function isValidName(str) {
  if (!str || str.trim().length < 2) return false;
  if (isUrl(str)) return false;
  if (str.includes('@') && str.includes('.')) return false;
  if (str.length > 150) return false;
  if (/^"?name"?$/i.test(str.trim())) return false;
  if (str.includes('{') || str.includes('}')) return false;
  if (/^\d+$/.test(str.trim())) return false;
  return true;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// ── JSON-LD extraction ───────────────────────────────────────────────────────

function parseJsonLd(html) {
  const result = { author: '', date: '' };
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  for (const block of blocks) {
    try {
      const raw = block.replace(/<\/?script[^>]*>/gi, '').trim();
      const data = JSON.parse(raw);
      const objs = Array.isArray(data) ? data : [data];

      for (const obj of objs) {
        // Author
        if (!result.author && obj.author) {
          const a = Array.isArray(obj.author) ? obj.author[0] : obj.author;
          if (typeof a === 'string' && isValidName(a)) result.author = a;
          else if (a && typeof a.name === 'string' && isValidName(a.name)) result.author = a.name;
        }

        // Date
        if (!result.date) {
          const d = obj.datePublished || obj.dateCreated || obj.uploadDate || obj.dateModified;
          if (d && typeof d === 'string') result.date = d;
        }

        if (result.author && result.date) break;
      }
    } catch (e) {}

    if (result.author && result.date) break;
  }

  return result;
}

// ── Main extraction ──────────────────────────────────────────────────────────

function extractMeta(html, pageUrl) {
  const $ = cheerio.load(html);

  const getMeta = (...selectors) => {
    for (const sel of selectors) {
      const val = ($(sel).attr('content') || $(sel).text() || '').trim();
      if (val.length > 1) return val;
    }
    return '';
  };

  // ── Title ──
  const title =
    getMeta('meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]') ||
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    '';

  // ── Site name ──
  const siteName =
    getMeta('meta[property="og:site_name"]') ||
    new URL(pageUrl).hostname.replace(/^www\./, '');

  // ── JSON-LD (most reliable source) ──
  const jsonLd = parseJsonLd(html);

  // ── Author ──
  let author = '';
  const authorSources = [
    getMeta('meta[name="author"]'),
    getMeta('meta[property="article:author"]'),
    getMeta('meta[name="twitter:creator"]'),
    jsonLd.author,
    $('[rel="author"]').first().text().trim(),
    $('[itemprop="author"] [itemprop="name"]').first().text().trim(),
    $('[itemprop="author"]').first().text().trim(),
    $('[class*="author__name"]').first().text().trim(),
    $('[class*="byline"]').first().text().trim().replace(/^by\s+/i, ''),
    $('[class*="author-name"]').first().text().trim(),
  ];

  for (const src of authorSources) {
    if (isValidName(src)) { author = src; break; }
  }

  // ── Date ──
  let rawDate =
    getMeta('meta[property="article:published_time"]') ||
    getMeta('meta[name="date"]') ||
    getMeta('meta[name="pubdate"]') ||
    getMeta('meta[name="publish-date"]') ||
    getMeta('meta[name="publication_date"]') ||
    getMeta('meta[itemprop="datePublished"]') ||
    jsonLd.date ||
    $('time[datetime]').attr('datetime') ||
    $('[itemprop="datePublished"]').attr('content') ||
    $('[itemprop="datePublished"]').text().trim() ||
    '';

  let year = '', month = '', day = '';
  const parsed = parseDate(rawDate);
  if (parsed) {
    year = parsed.getFullYear().toString();
    month = parsed.toLocaleString('en-US', { month: 'long' });
    day = parsed.getDate().toString();
  }

  // ── Clean up ──
  const clean = s => (s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

  return {
    title: clean(title),
    author: clean(author),
    year,
    month,
    day,
    siteName: clean(siteName),
    url: pageUrl,
  };
}
