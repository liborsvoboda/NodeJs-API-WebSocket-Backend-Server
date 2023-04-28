const Sequelize = require('sequelize');
const moment = require('moment');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const SessionsModel = require('../data_models/sessions');
const ContributionsTypeListModel = require('../data_models/contribution_type');
const CandidateAcceptationModel = require('../data_models/candidate_acceptation');
const ContributionPaymentsModel = require('../data_models/contribution_payments');
const CurrencyListModel = require('../data_models/currency');
const TagListModel = require('../data_models/taglist');
const PhoneCodesModel = require('../data_models/phonecodes');

const AppSettingsModel = require('../data_models/appSettings');
const UserFiltersModel = require('../data_models/user_filters');
const AttachmentsModel = require('../data_models/attachments');
const ContributionsModel = require('../data_models/contribution');
const UsersModel = require('../data_models/users');
const LoginHistoryModel = require('../data_models/login_history');
const ProblemReportModel = require('../data_models/problem_report');


const cfg = JSON.parse(fs.readFileSync('./config/api_config.json'));
const sequelize = new Sequelize(cfg.server.db.dbname, cfg.server.db.user, cfg.server.db.password, {
  host: cfg.server.db.host,
  dialect: cfg.server.db.type,
  logging: false,
  operatorsAliases: false,
  pool: {
    max: cfg.server.db.poolMax,
    min: cfg.server.db.poolMin,
    acquire: cfg.server.db.poolAcquire,
    idle: cfg.server.db.poolIdle
    },
  dialectOptions: {
        //        useUTC: false, 
        dateStrings: true,
        typeCast: true
  },
  keepDefaultTimezone: true
});

const Sessions = SessionsModel(sequelize, Sequelize);
const CurrencyList = CurrencyListModel(sequelize, Sequelize);
const ContributionsTypeList = ContributionsTypeListModel(sequelize, Sequelize);
const CandidateAcceptation = CandidateAcceptationModel(sequelize, Sequelize);
const UserFilters = UserFiltersModel(sequelize, Sequelize);


const TagList = TagListModel(sequelize, Sequelize);
const PhoneCodes = PhoneCodesModel(sequelize, Sequelize);

const AppSettings = AppSettingsModel(sequelize, Sequelize);
const Attachments = AttachmentsModel(sequelize, Sequelize);
const Contributions = ContributionsModel(sequelize, Sequelize);
const ContributionPayments = ContributionPaymentsModel(sequelize, Sequelize);
const Users = UsersModel(sequelize, Sequelize);
const LoginHistory = LoginHistoryModel(sequelize, Sequelize);
const ProblemReport = ProblemReportModel(sequelize, Sequelize);

var hooks = {
  user: (instance, options) => {
    if (instance.changed('password')) {
      return bcrypt.hash(instance.get('password'), cfg.server.bcrypt.rounds).then(hash => {
        return instance.set('password', hash);
      });
    }
  },
  session: (instance, options) => {
    if (instance !== null && 'dataValues' in instance && 'session' in instance.dataValues && 'ip' in instance.dataValues) {
      return Sessions.update({ lastActivity: moment().unix() }, { where: { session: instance.dataValues.session, ip: instance.dataValues.ip }}).then((result) => {
        return result;
      }).catch(err => {
        throw new Error(err);
      });
    }
  }
};

Users.prototype.comparePassword = function(password) {
  return new Promise(resolve => {
    bcrypt.compare(password, this.password, (err, res) => {
      resolve(res);
    });
  });
};

//hooks
Users.beforeCreate(hooks.user);
Users.beforeUpdate(hooks.user);


//Lists



//data foreign keys
Sessions.afterFind(hooks.session);
Sessions.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});


Contributions.belongsTo(ContributionsTypeList, {
    foreignKey: 'type',
    targetKey: 'id',
    onDelete: 'CASCADE'
});

CandidateAcceptation.belongsTo(Contributions, {
    foreignKey: 'contribution_id',
    targetKey: 'id',
    onDelete: 'CASCADE'
});

Contributions.belongsTo(CurrencyList, {
    foreignKey: 'currency',
    targetKey: 'id',
    onDelete: 'CASCADE'
});

Contributions.belongsTo(Users, {
    foreignKey: 'uuid',
    targetKey: 'uuid',
    onDelete: 'CASCADE'
});

LoginHistory.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});

Users.belongsTo(ProblemReport, {
  foreignKey: 'uuid',
  targetKey: 'reportedUuid',
  onDelete: 'CASCADE'
});

Users.hasMany(Contributions, {
    foreignKey: 'uuid',
    targetKey: 'uuid',
    onDelete: 'CASCADE'
});


// export models
module.exports.Sessions = Sessions;
module.exports.ContributionsTypeList = ContributionsTypeList;
module.exports.CandidateAcceptation = CandidateAcceptation;
module.exports.CurrencyList = CurrencyList;
module.exports.TagList = TagList;
module.exports.PhoneCodes = PhoneCodes;

module.exports.Users = Users;
module.exports.Contributions = Contributions;
module.exports.ContributionPayments = ContributionPayments;

module.exports.AppSettings = AppSettings;
module.exports.Attachments = Attachments;
module.exports.LoginHistory = LoginHistory;
module.exports.UserFilters = UserFilters;
module.exports.ProblemReport = ProblemReport;

