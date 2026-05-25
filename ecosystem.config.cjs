module.exports = {
  apps: [
    {
      name: "aimh1-portal",
      cwd: "./server",
      script: "src/server.js",
      exec_mode: "cluster",
      instances: 10,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
        PORT: 7998
      }
    }
  ]
};
