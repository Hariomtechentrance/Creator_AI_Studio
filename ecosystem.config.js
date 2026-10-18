module.exports = {
  apps: [
    {
      name: 'creatorai-studio',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
      },
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_restarts: 5,
    },
  ],
};
