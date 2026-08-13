module.exports = {
  apps: [
    {
      name: "coffeebay-web",

      cwd: "/var/www/coffeebay",

      script: "./node_modules/next/dist/bin/next",

      args: "start -H 127.0.0.1 -p 3000",

      exec_mode: "fork",
      instances: 1,

      autorestart: true,
      min_uptime: "15s",
      max_restarts: 20,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,

      max_memory_restart: "1500M",

      kill_timeout: 5000,
      listen_timeout: 10000,

      watch: false,

      time: true,
      merge_logs: true,

      out_file: "/var/www/logs/web-out.log",
      error_file: "/var/www/logs/web-error.log",

      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--enable-source-maps",
      },
    },

    {
      name: "coffeebay-notification-worker",

      cwd: "/var/www/coffeebay",

      script: "pnpm",

      args: "run notification-worker",

      exec_mode: "fork",
      instances: 1,

      autorestart: true,
      min_uptime: "15s",
      max_restarts: 20,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,

      max_memory_restart: "512M",

      kill_timeout: 5000,

      watch: false,

      time: true,
      merge_logs: true,

      out_file: "/var/www/logs/worker-out.log",
      error_file: "/var/www/logs/worker-error.log",

      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--enable-source-maps",
      },
    },
  ],
};