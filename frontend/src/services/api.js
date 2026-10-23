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

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Something went wrong");
  }

  return result;
}