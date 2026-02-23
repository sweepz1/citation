exports.handler = async (event, context) => {
  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) return { statusCode: 400, body: JSON.stringify({ ok: false }) };

    // Replace with your actual fetch-meta logic
    const meta = {
      title: 'Sample Page',
      author: 'Jane Doe',
      year: '2024',
      month: 'March',
      day: '15',
      siteName: 'Example Site',
      url: url,
    };

    return { statusCode: 200, body: JSON.stringify({ ok: true, meta }) };
  } catch {
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};