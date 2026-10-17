/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAP_PROVIDER?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
  readonly VITE_OSRM_BASE_URL?: string;
  readonly VITE_ORIGIN_LAT?: string;
  readonly VITE_ORIGIN_LNG?: string;
  readonly VITE_ORIGIN_NAME?: string;
}
interface Window {
  google?: any;
  __optilogicGoogleReady?: () => void;
  gm_authFailure?: () => void;
}
