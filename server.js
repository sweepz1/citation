// ============================================================
// APA 7 Citation Machine - Backend Server
// Run with: node server.js
// Then open your browser to: http://localhost:3000
// ============================================================

// 'http' is a built-in Node.js module — no installation needed
const http = require('http');

// 'url' helps us parse incoming request URLs
const url = require('url');

// 'fs' lets us read files from the disk (like our HTML page)
const fs = require('fs');

// 'path' helps build safe file paths across different operating systems
const path = require('path');

// ---- APA 7 Formatting Logic --------------------------------

/**
 * Formats author names into APA 7 style.
 * Input:  "Jane Doe, John Smith"
 * Output: "Doe, J., & Smith, J."
 *
 * If the user already typed something like "Doe, J.", we leave it as-is.
 */
function formatAuthors(authorsRaw) {
  // Split multiple authors by comma or semicolon
  const authors = authorsRaw.split(/[,;](?=\s*[A-Z])/).map(a => a.trim()).filter(Boolean);

  const formatted = authors.map(author => {
    // If it already looks like "Last, F." style, keep it
    if (/,\s*[A-Z]\./.test(author)) return author;

    const parts = author.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]; // single name / org

    const last = parts[parts.length - 1];
    const initials = parts.slice(0, -1).map(p => p[0].toUpperCase() + '.').join(' ');
    return `${last}, ${initials}`;
  });

  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;

  // Three or more authors: list all with & before the last
  const allButLast = formatted.slice(0, -1).join(', ');
  return `${allButLast}, & ${formatted[formatted.length - 1]}`;
}

/**
 * Builds the final APA 7 citation string based on source type.
 *
 * APA 7 formats:
 *   Book:    Author(s). (Year). Title. Publisher.
 *   Article: Author(s). (Year). Title. Journal Name.
 *   Website: Author(s). (Year). Title. URL
 */
function buildCitation(data) {
  const { authors, year, title, sourceType, publisherOrUrl } = data;

  // Format the author string
  const authorStr = authors ? formatAuthors(authors) : '[No author]';

  // Wrap the year in parentheses
  const yearStr = year ? `(${year})` : '(n.d.)';

  // Italicize the title for books/websites; keep plain for articles
  // We'll use HTML <em> tags so the browser renders it in italics
  const titleStr = (sourceType === 'book' || sourceType === 'website')
    ? `<em>${title}</em>`
    : title;

  switch (sourceType) {
    case 'book':
      return `${authorStr}. ${yearStr}. ${titleStr}. ${publisherOrUrl}.`;

    case 'article':
      // Journal name is italicized in APA 7
      return `${authorStr}. ${yearStr}. ${titleStr}. <em>${publisherOrUrl}</em>.`;

    case 'website':
      return `${authorStr}. ${yearStr}. ${titleStr}. ${publisherOrUrl}`;

    default:
      return 'Unknown source type. Please select Book, Article, or Website.';
  }
}

// ---- HTTP Server -------------------------------------------

const PORT = 3000;

const server = http.createServer((req, res) => {

  // Parse the incoming URL so we can check the path
  const parsedUrl = url.parse(req.url, true); // true = parse query string too
  const pathname = parsedUrl.pathname;

  // ── Route 1: Serve the HTML page at "/"
  if (req.method === 'GET' && pathname === '/') {
    const filePath = path.join(__dirname, 'index.html');

    fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) {
        res.writeHead(500);
        res.end('Could not load index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });

  // ── Route 2: Handle citation generation at "/generate"
  } else if (req.method === 'POST' && pathname === '/generate') {

    // Collect the POST body chunks as they stream in
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', () => {
      // Parse the URL-encoded form data (e.g. "authors=Doe&year=2020&...")
      const formData = new URLSearchParams(body);

      const data = {
        authors:        formData.get('authors') || '',
        year:           formData.get('year') || '',
        title:          formData.get('title') || '',
        sourceType:     formData.get('sourceType') || 'book',
        publisherOrUrl: formData.get('publisherOrUrl') || '',
      };

      // Build the APA citation
      const citation = buildCitation(data);

      // Send back JSON so the browser can display it without reloading
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ citation }));
    });

  // ── Route 3: Anything else → 404
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start listening for requests
server.listen(PORT, () => {
  console.log(`✅ APA Citation Machine running!`);
  console.log(`👉 Open your browser and go to: http://localhost:${PORT}`);
});
