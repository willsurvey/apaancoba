const API_URL =
  'https://raw.githubusercontent.com/willsurvey/apaansihh/refs/heads/main/latest_screening.json';

export async function fetchScreeningData() {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('API fetch error:', error);
    return { success: false, error: error.message };
  }
}
