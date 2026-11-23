// src/utils/safeFetch.js
// Resilient fetch wrapper for iframe / proxy environments (e.g. Firefox + Cloud Run proxy)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function safeFetch(url, options = {}, retries = 2) {
  const fetchOptions = {
    credentials: 'include',
    ...options
  };

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } catch (err) {
      lastError = err;
      const isNetworkError =
        err instanceof TypeError ||
        /NetworkError|Failed to fetch|Load failed/i.test(err?.message || '');

      if (!isNetworkError || attempt === retries) {
        throw err;
      }

      await sleep(400 * (attempt + 1));
    }
  }

  throw lastError;
}
