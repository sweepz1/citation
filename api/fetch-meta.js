// api/fetch-meta.js — Vercel serverless function

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
    /<title[^>]*>([^<]{2,200})<\/title>/i,
  ]);

  const author = get([
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']{2,100})["']/i,
    /<meta[^>]+content=["']([^"']{2,100})["'][^>]+name=["']author["']/i,
    /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']{2,100})["']/i,
    /"author"\s*:\s*\[.*?"name"\s*:\s*"([^"]{2,100})"/i,
    /"author"\s*:\s*\{\s*(?:"@type"[^}]*)?"name"\s*:\s*"([^"]{2,100})"/i,
    /"author"\s*:\s*"([^"]{2,100})"/i,
  ]);

  const date = get([
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
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

const timeout = (ms) => new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Timed out')), ms)
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { url: targetUrl } = req.body;
    if (!targetUrl) return res.status(400).json({ ok: false, error: 'Missing URL' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    let html;
    try {
      const response = await Promise.race([
        fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
        }),
        timeout(5000)
      ]);
      clearTimeout(timer);
      html = await Promise.race([response.text(), timeout(3000)]);
    } catch (e) {
      clearTimeout(timer);
      return res.status(200).json({ ok: false, error: 'Page took too long — fill in fields manually' });
    }

    const meta = extractMeta(html, targetUrl);
    return res.json({ ok: true, meta });

  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
};
