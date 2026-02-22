const form = document.querySelector("form");
const output = document.querySelector("#output");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.querySelector("#input").value;

  try {
    const res = await fetch("/.netlify/functions/generate", {
      method: "POST",
      body: JSON.stringify({ input }),
    });
    const data = await res.json();
    output.textContent = data.result;
  } catch (err) {
    output.textContent = "Error contacting serverless function";
  }
});