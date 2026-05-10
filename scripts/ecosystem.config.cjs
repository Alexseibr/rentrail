module.exports = {
  apps: [
    {
      name: "rideflow-api",
      script: "/opt/rideflow/api/dist/index.mjs",
      cwd: "/opt/rideflow/api",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: "8080",
        DATABASE_URL:
          "postgresql://rideflow:RideFlow2026!secure@localhost:5432/rideflow",
        SESSION_SECRET:
          "A2noQb8nQgN8IRjdTqo6_d84GNZJN6TAKImrMNl7an9Ji0QffAi99E1JYNDhcizt",
        LOG_LEVEL: "info",
      },
      error_file: "/opt/rideflow/logs/api-error.log",
      out_file: "/opt/rideflow/logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10,
      watch: false,
    },
  ],
};
