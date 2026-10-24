const BASE_URL = "/api";

export async function apiRequest(action, method = "GET", data = null) {
  let csrfToken;
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    // Fetch for each mutation so logout, expiry, and another tab cannot leave a cached token.
    const tokenResponse = await fetch(BASE_URL + "?action=csrf-token", {
      credentials: "same-origin", cache: "no-store"
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.csrf_token) {
      throw new Error("Unable to verify session. Please refresh and try again.");
    }
    csrfToken = tokenData.csrf_token;
  }
  const response = await fetch(`${BASE_URL}?action=${action}`, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
    },
    ...(data !== null ? { body: JSON.stringify(data) } : {})
  });

  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("PHP returned an invalid JSON response");
  }

  if (!response.ok) {
    throw new Error(result.error || "Something went wrong");
  }

  return result;
}