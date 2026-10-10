export const apiConfig = {
  mapbox: {
    token: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "",
    isConfigured: !!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN && 
                  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN !== "YOUR_MAPBOX_TOKEN" &&
                  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN.trim() !== ""
  },
  gemini: {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
    isConfigured: !!import.meta.env.VITE_GEMINI_API_KEY && 
                  import.meta.env.VITE_GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY" &&
                  import.meta.env.VITE_GEMINI_API_KEY.trim() !== ""
  },
  openWeather: {
    apiKey: import.meta.env.VITE_OPENWEATHER_API_KEY || "",
    isConfigured: !!import.meta.env.VITE_OPENWEATHER_API_KEY && 
                  import.meta.env.VITE_OPENWEATHER_API_KEY !== "YOUR_OPENWEATHER_API_KEY" &&
                  import.meta.env.VITE_OPENWEATHER_API_KEY.trim() !== ""
  },
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    isConfigured: false // Integration slot placeholder
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || "",
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    isConfigured: false // Integration slot placeholder
  }
};

// Development-only console warnings for missing secrets
if (import.meta.env.DEV) {
  if (!apiConfig.mapbox.isConfigured) {
    console.warn(
      "⚠️ [Sentinel API Config]: VITE_MAPBOX_ACCESS_TOKEN is missing or set to placeholder. falling back to CartoDB Voyager/Dark Matter raster tiles."
    );
  }
  if (!apiConfig.gemini.isConfigured) {
    console.warn(
      "⚠️ [Sentinel API Config]: VITE_GEMINI_API_KEY is missing. Gemini AI classification and assistant responses will run in placeholder simulator mode."
    );
  }
  if (!apiConfig.openWeather.isConfigured) {
    console.warn(
      "⚠️ [Sentinel API Config]: VITE_OPENWEATHER_API_KEY is missing. Weather details will fall back to local simulated telemetry."
    );
  }
}
