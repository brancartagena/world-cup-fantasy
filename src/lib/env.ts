export function getServerEnv() {
  return {
    apiFootballKey: process.env.API_FOOTBALL_KEY ?? "",
    balldontlieApiKey: process.env.BALLDONTLIE_API_KEY ?? "",
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
  ];
}
