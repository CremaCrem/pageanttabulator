// src/api/client.ts
import { isTauri } from '@tauri-apps/api/core';

export const getApiBaseUrl = () => {
  // If we are in Tauri dev mode, point to the Rust dev server
  if (isTauri()) {
    return 'http://localhost:3000';
  }
  // If we are in a regular browser (dev mode), point to Rust dev server
  if (import.meta.env.DEV && !isTauri()) {
    // Determine the host (could be localhost or IP)
    const host = window.location.hostname;
    return `http://${host}:3000`;
  }
  // In production, the React app is served directly by the Rust axum server on port 3000,
  // so relative paths work automatically! (e.g., /api/judges)
  return '';
};

export const fetchApi = async (endpoint: string, options?: RequestInit, retries = 3): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errMessage = `Error ${res.status}`;
      try {
        const data = await res.json();
        if (data.error) errMessage = data.error;
      } catch (e) {
        // Ignore json parse error
      }
      throw new Error(errMessage);
    }

    return await res.json();
  } catch (err: any) {
    if (retries > 0 && err.message === 'Failed to fetch') {
      console.warn(`Network error on ${endpoint}. Retrying in 1s... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchApi(endpoint, options, retries - 1);
    }
    throw err;
  }
};

export const uploadFile = async (endpoint: string, file: File, retries = 3): Promise<{ url: string }> => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      let errMessage = `Error ${res.status}`;
      try {
        const data = await res.json();
        if (data.error) errMessage = data.error;
      } catch (e) {
        // Ignore json parse error
      }
      throw new Error(errMessage);
    }

    return await res.json();
  } catch (err: any) {
    if (retries > 0 && err.message === 'Failed to fetch') {
      console.warn(`Network error on upload. Retrying in 1s... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return uploadFile(endpoint, file, retries - 1);
    }
    throw err;
  }
};
