exports.handler = async (event, context) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const input = body.input || "No input provided";

    // Example backend logic (replace with your own)
    const result = `You sent: ${input}`;

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