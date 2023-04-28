const Sequelize = require('sequelize');
const moment = require('moment');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const SessionsModel = require('../sp_data_models/sessions');
const UsersModel = require('../sp_data_models/users');

const cfg = JSON.parse(fs.readFileSync('./sp_config/ws_config.json', 'utf-8'));

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
    dialectOptions: {
        //        useUTC: false, 
        dateStrings: true,
        typeCast: true
    },
    keepDefaultTimezone: true
});


const Sessions = SessionsModel(sequelize, Sequelize);
const Users = UsersModel(sequelize, Sequelize);

var hooks = {
    session: (instance, options) => {
        if (instance !== null && 'dataValues' in instance && 'session' in instance.dataValues && 'ip' in instance.dataValues) {
            return Sessions.update({ lastActivity: moment().unix() }, { where: { session: instance.dataValues.session, ip: instance.dataValues.ip } }).then((result) => {
                return result;
            }).catch(err => {
                throw new Error(err);
            });
        }
    }
};

Sessions.afterFind(hooks.session);
Sessions.belongsTo(Users, {
    foreignKey: 'uuid',
    targetKey: 'uuid',
    onDelete: 'CASCADE'
});


// export models
module.exports.Sessions = Sessions;
module.exports.Users = Users;

sequelize.sync().then(() => {
    console.log('DB tables OK');
}).catch(err => {
    console.log(err);
});
