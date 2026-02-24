// api/fetch-meta.js — Vercel serverless function

function fetchHTML(targetUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    let parsedUrl;
    try { parsedUrl = new URL(targetUrl); } catch(e) { return reject(new Error('Invalid URL')); }

    const lib = parsedUrl.protocol === 'https:' ? require('https') : require('http');
    const req = lib.get({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 5000,
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
    /"author"\s*:\s*\[.*?"name"\s*:\s*"([^"]{2,100})"/i,
    /"author"\s*:\s*\{\s*(?:"@type"[^}]*)?"name"\s*:\s*"([^"]{2,100})"/i,
    /"author"\s*:\s*"([^"]{2,100})"/i,
    /[Bb]y\s+([A-Z][a-z\-']+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z\-']+)/,
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
      year = d.getFullYear().toString();
      month = d.toLocaleString('en-US', { month: 'long' });
      day = d.getDate().toString();
    }
  }

  return { title, author, year, month, day, siteName, url: pageUrl };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { url: targetUrl } = req.body;
    if (!targetUrl) return res.status(400).json({ ok: false, error: 'Missing URL' });
    const html = await fetchHTML(targetUrl);
    const meta = extractMeta(html, targetUrl);
    return res.json({ ok: true, meta });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
