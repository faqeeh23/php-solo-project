const BASE_URL = "/api";

export async function apiRequest(action, method = "GET", data = null) {
  const response = await fetch(`${BASE_URL}?action=${action}`, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    ...(data !== null ? { body: JSON.stringify(data) } : {})
  });

  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    console.error("Invalid API response:", text);
    throw new Error("PHP returned an invalid JSON response");
  }

  if (!response.ok) {
    throw new Error(result.error || "Something went wrong");
  }

  return result;
}