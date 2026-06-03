export function getServerEnv() {
  return {
    apiFootballKey: process.env.API_FOOTBALL_KEY ?? "",
    balldontlieApiKey: process.env.BALLDONTLIE_API_KEY ?? "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

export function getDataSourceReadiness() {
  const env = getServerEnv();

  return [
    {
      source: "openfootball",
      ready: true,
      message: "No API key required.",
    },
    {
      source: "api-football",
      ready: env.apiFootballKey.length > 0,
      message: env.apiFootballKey
        ? "API_FOOTBALL_KEY is configured."
        : "Add API_FOOTBALL_KEY to .env.local.",
    },
    {
      source: "balldontlie",
      ready: env.balldontlieApiKey.length > 0,
      message: env.balldontlieApiKey
        ? "BALLDONTLIE_API_KEY is configured."
        : "Add BALLDONTLIE_API_KEY to .env.local.",
    },
    {
      source: "supabase",
      ready: env.supabaseUrl.length > 0 && env.supabasePublishableKey.length > 0,
      message:
        env.supabaseUrl && env.supabasePublishableKey
          ? "Supabase project URL and publishable key are configured."
          : "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    },
  ];
}
