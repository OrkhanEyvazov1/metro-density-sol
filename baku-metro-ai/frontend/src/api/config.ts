/**
 * Runtime endpoints. Centralised so swapping mock generator for real
 * AI cameras (or pointing at staging/production) needs only env tweaks.
 */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

function deriveWsUrlFromApi(apiUrl: string): string {
  if (apiUrl.startsWith("https://")) {
    return apiUrl.replace("https://", "wss://");
  }
  if (apiUrl.startsWith("http://")) {
    return apiUrl.replace("http://", "ws://");
  }
  return "ws://localhost:8000";
}

export const WS_URL: string =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? deriveWsUrlFromApi(API_URL);

export const NUM_TRAINS: number = Number(
  (import.meta.env.VITE_NUM_TRAINS as string | undefined) ?? 10
);
