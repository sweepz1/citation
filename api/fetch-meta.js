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

function isUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

function isValidName(str) {
  if (!str || str.trim().length < 2) return false;
  if (isUrl(str)) return false;
  if (str.includes('@') && str.includes('.')) return false;
  if (str.length > 100) return false;
  // Reject bare property names or JSON fragments
  if (/^"?name"?$/.test(str.trim())) return false;
  if (str.includes('{') || str.includes('"')) return false;
  return true;
}

function extractAuthorFromJsonLd(html) {
  // Find JSON-LD script blocks and parse author from them properly
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of matches) {
    try {
      const json = block.replace(/<\/?script[^>]*>/gi, '');
      const data = JSON.parse(json);
      const objs = Array.isArray(data) ? data : [data];
      for (const obj of objs) {
        const author = obj.author;
        if (!author) continue;
        const authorObj = Array.isArray(author) ? author[0] : author;
        if (typeof authorObj === 'string' && isValidName(authorObj)) return authorObj;
        if (authorObj && typeof authorObj.name === 'string' && isValidName(authorObj.name)) return authorObj.name;
      }
    } catch(e) {}
  }
  return '';
}

function extractMeta(html, pageUrl) {
  const $ = cheerio.load(html);

  const getMeta = (selectors) => {
    for (const sel of selectors) {
      const el = $(sel);
      const val = el.attr('content') || el.text();
      if (val && val.trim().length > 1) return val.trim();
    }
    return '';
  };

  const title = getMeta([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
  ]) || $('title').text().trim() || '';

  // Try multiple author sources, skip any that are URLs
  let author = '';
  const authorCandidates = [
    getMeta(['meta[name="author"]']),
    getMeta(['meta[name="twitter:creator"]']),
    getMeta(['meta[property="article:author"]']),
    extractAuthorFromJsonLd(html),
    $('[rel="author"]').first().text().trim(),
    $('[itemprop="author"] [itemprop="name"]').first().text().trim(),
    $('[itemprop="author"]').first().text().trim(),
  ];

  for (const candidate of authorCandidates) {
    if (isValidName(candidate)) {
      author = candidate;
      break;
    }
  }

  const date = getMeta([
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="pubdate"]',
    'meta[itemprop="datePublished"]',
  ]) || $('time[datetime]').attr('datetime') || '';

  const siteName = getMeta(['meta[property="og:site_name"]']) ||
    new URL(pageUrl).hostname.replace(/^www\./, '');

  let year = '', month = '', day = '';
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear().toString();
      month = d.toLocaleString('en-US', { month: 'long' });
      day = d.getDate().toString();
    }
  }

  const clean = s => (s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

  return {
    title: clean(title),
    author: clean(author),
    year, month, day,
    siteName: clean(siteName),
    url: pageUrl,
  };
}
