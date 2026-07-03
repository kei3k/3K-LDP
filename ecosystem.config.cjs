// pm2 process definition for the production Express server.
// Secrets are NOT here — server/index.js loads them via dotenv from
// the .env file in this project's root (see .env.production.example).
module.exports = {
  apps: [
    {
      name: 'zumia-tool-nam',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      error_file: '/root/.pm2/logs/zumia-tool-nam-error.log',
      out_file: '/root/.pm2/logs/zumia-tool-nam-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
