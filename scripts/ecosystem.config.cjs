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
        PORT: 8080,
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
