module.exports = {
  apps: [
    {
      name        : "API",
      cwd         : "/home/happytohelp/",
      script      : "./api_server.js",
      watch       : true,
      env: {
        "NODE_ENV": "development",
      },
      env_production : {
        "NODE_ENV": "production"
      }
    },
    {
        name: "WebSockets",
        cwd: "/home/happytohelp/",
        script: "./ws_server.js",
        watch: true,
        env: {
            "NODE_ENV": "development",
        },
        env_production: {
            "NODE_ENV": "production"
        }
    },
    {
        name: "Cron",
        cwd: "/home/happytohelp/",
        script: "./cron_server.js",
        watch: true,
        cron_restart: "50 4 * * *",
        env: {
            "NODE_ENV": "development",
        },
        env_production: {
            "NODE_ENV": "production"
        }
    },
   {
      name        : "SPORT_API",
      cwd         : "/home/happytohelp/",
      script      : "./sp_api_server.js",
      watch       : true,
      env: {
        "NODE_ENV": "development",
      },
      env_production : {
        "NODE_ENV": "production"
      }
    },
    {
        name: "SPORT_WebSockets",
        cwd: "/home/happytohelp/",
        script: "./sp_ws_server.js",
        watch: true,
        env: {
            "NODE_ENV": "development",
        },
        env_production: {
            "NODE_ENV": "production"
        }
    },
    {
        name: "SPORT_Cron",
        cwd: "/home/happytohelp/",
        script: "./sp_cron_server.js",
        watch: true,
        cron_restart: "50 4 * * *",
        env: {
            "NODE_ENV": "development",
        },
        env_production: {
            "NODE_ENV": "production"
        }
    }


  ]
}
