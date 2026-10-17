import { createClient } from "@supabase/supabase-js";
import { config, isDemo } from "./config";
export const authClient =
  !isDemo &&
  config.supabaseUrl &&
  config.supabaseKey &&
  !config.supabaseUrl.includes("YOUR_PROJECT")
    ? createClient(config.supabaseUrl, config.supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
