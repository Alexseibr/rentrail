export const config = {
  jwt: {
    accessSecret: process.env.SESSION_SECRET || "dev-access-secret",
    refreshSecret: process.env.SESSION_SECRET ? process.env.SESSION_SECRET + "-refresh" : "dev-refresh-secret",
    accessExpiresIn: "15m",
    refreshExpiresIn: "7d",
    refreshExpiresInMs: 7 * 24 * 60 * 60 * 1000,
  },
  bcrypt: {
    saltRounds: 12,
  },
};
