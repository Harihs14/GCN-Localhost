/**
 * Application configuration
 */

// Get the base API URL based on environment
const getBaseUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return `${import.meta.env.VITE_BACKEND_URL}/api`;
  }

  if (typeof window !== "undefined") {
    // If accessed through ngrok, use the current protocol and host
    if (window.location.hostname.includes("ngrok")) {
      return `${window.location.protocol}//${window.location.host}/api`;
    }

    // When running locally, connect to the local backend
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }

  // Default to localhost for local development
  return "http://localhost:5000/api";
};

export const API_BASE_URL = getBaseUrl();
