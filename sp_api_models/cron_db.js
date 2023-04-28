const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');

const UsersModel = require('../sp_data_models/users');
const ContributionPaymentsModel = require('../sp_data_models/contribution_payments');
const ProblemReportModel = require('../sp_data_models/problem_report');

const cfg = JSON.parse(fs.readFileSync('./sp_config/cron_config.json'));
const sequelize = new Sequelize(cfg.db.dbname, cfg.db.user, cfg.db.password, {
  host: cfg.db.host,
  dialect: cfg.db.type,
  logging: false,
  operatorsAliases: false,
  pool: {
    max: cfg.db.poolMax,
    min: cfg.db.poolMin,
    acquire: cfg.db.poolAcquire,
    idle: cfg.db.poolIdle
  },
  keepDefaultTimezone: true
});

const ContributionPayments = ContributionPaymentsModel(sequelize, Sequelize);
const ProblemReport = ProblemReportModel(sequelize, Sequelize);
const Users = UsersModel(sequelize, Sequelize);



// create all the defined tables in the specified database
sequelize.sync().then(() => {
  console.log('DB tables OK');
}).catch(err => {
  console.log(err);
});

// export models
module.exports.ProblemReport = ProblemReport;
module.exports.ContributionPayments = ContributionPayments;
module.exports.Users = Users;

