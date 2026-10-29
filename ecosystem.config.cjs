module.exports = {
  apps: [
    {
      name: 'erp-api',
      cwd: '/srv/erp-app/app',
      script: 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '700M',
      time: true,
    },
  ],
};