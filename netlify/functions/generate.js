exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body || '{}');

    // Put your original citation generation logic here
    const reference = `Generated reference for: ${body.title || 'N/A'}`;
    const inText   = `(Author, ${body.year || 'N/A'})`;

    return {
      statusCode: 200,
      body: JSON.stringify({ reference, inText }),
    };
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverless function error' }) };
  }
};