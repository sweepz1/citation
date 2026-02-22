// ============================================================
// Netlify Function: generate
// Generates APA 7 compliant citations
// ============================================================

// ── Sentence case (APA 7 rule for titles) ───────────────────
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
  if (sourceType === 'website') {
    const site = siteName ? `${siteName.trim()}. ` : '';
    ref = hasAuthor
      ? `${authorStr}. ${dateParens}. <em>${titleSC}</em>. ${site}${webUrl}`
      : `<em>${titleSC}</em>. ${dateParens}. ${site}${webUrl}`;
    ref = ref.replace(/\s+/g, ' ').trimEnd();
  }

  // ── Book ─────────────────────────────────────────────────────
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
  else if (sourceType === 'newspaper') {
    const paper = journal ? `<em>${journal}</em>. ` : '';
    ref = hasAuthor
      ? `${authorStr}. ${dateParens}. ${titleSC}. ${paper}`
      : `${titleSC}. ${dateParens}. ${paper}`;
    ref = ref.replace(/\s+/g, ' ').trimEnd().replace(/\.$/, '');
    ref = webUrl ? `${ref} ${webUrl}` : `${ref}.`;
  }

  // ── YouTube Video ────────────────────────────────────────────
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

// ── Netlify Function Handler ────────────────────────────────
exports.handler = async (event) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const data = JSON.parse(event.body);
    const result = buildCitation(data);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ ok: true, ...result }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
};
