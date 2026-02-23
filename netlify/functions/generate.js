exports.handler = async (event, context) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const input = body.input || "No input provided";

    // Example citation logic (replace with your actual logic)
    const result = `Citation generated for: ${input}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ result }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Serverless function error" }),
    };
  }
};