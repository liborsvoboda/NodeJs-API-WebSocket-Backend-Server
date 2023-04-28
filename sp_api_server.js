const fs = require('fs');
const path = require('path');
const fastify = require('fastify');
const cors = require('fastify-cors');
const compress = require('fastify-compress');
const helmet = require('fastify-helmet');
const reCAPTCHA = require('recaptcha2');
const moment = require('moment');
const fastJson = require('fast-json-stringify');
const axios = require('axios');
const Sequelize = require('sequelize');
const IndexHints = Sequelize.IndexHints;
const db = require('./sp_api_models/api_db');
const { Op } = require("sequelize");
const parser = require('fast-xml-parser');
const cfg = JSON.parse(fs.readFileSync(path.join('./sp_config/api_config.json'), 'utf8'));
const schemas = JSON.parse(fs.readFileSync(path.join('./sp_api_schemas/api_schemas.json'), 'utf8'));
const msg = JSON.parse(fs.readFileSync(path.join('./sp_api_messages/api_messages.json'), 'utf8'));

//const ContributionsSchema = fastJson(schemas.getContributions.response);
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
    keepDefaultTimezone: true,
    dialectOptions: {
//        useUTC: false, 
        dateStrings: true,
        typeCast: true
    },
});
const recaptcha = new reCAPTCHA({
  siteKey: cfg.recaptcha.key,
  secretKey: cfg.recaptcha.secret,
  ssl: true
});
const recaptchaAndroid = new reCAPTCHA({
    siteKey: cfg.recaptchaAndroid.key,
    secretKey: cfg.recaptchaAndroid.secret,
    ssl: true
});


const server = fastify({
  http2: true,
  https: {
    key: fs.readFileSync(path.join(__dirname, cfg.server.ssl.key), 'utf8'),
    cert: fs.readFileSync(path.join(__dirname, cfg.server.ssl.cert), 'utf8')
  }
});
server.register(cors, {
  origin: true
});
server.register(compress);
server.register(helmet);

// test api
server.get('/', { schema: schemas.hello }, (req, reply) => {
  reply.header('Content-Type', 'application/json').code(200);
  reply.send({ hello: 'world' });
});

//registration login proccess
server.post('/signup', { schema: schemas.user, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptcha.validate(req.body.recaptcha).then(function () {
        return db.Users.create({
            email: req.body.email,
            password: req.body.password.length == 0 && (req.body.type == 'facebook' || req.body.type == 'google') ? '' : req.body.password,
            type: req.body.type,
            name: req.body.name,
            surName: req.body.surName,
            regEmail: req.body.email,
            isGdprConfirmed: req.body.isGdprConfirmed,
            nextPayDate: moment().add(14, 'days').format('YYYY-MM-DD'),
            nextPayDate_ts: moment().add(14, 'days').unix(),
            creditNextPayDate: moment().add(14, 'days').format('YYYY-MM-DD'),
            creditNextPayDate_ts: moment().add(14, 'days').unix(),
            registerDate: moment().format('YYYY-MM-DD'),
            deadtimeExpiration: moment().add(1, 'months').unix()
        }).then(user => {
            return reply.send(msg.signup.ok);
        }).catch(err => {
            console.log(err);
            return reply.send('email' in err.fields ? msg.signup.email : msg.db);
        });
    }).catch(function (errorCodes) {
        console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/signupApp', { schema: schemas.user, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptchaAndroid.validate(req.body.recaptcha).then(function () {
        return db.Users.create({
            email: req.body.email,
            password: req.body.password.length == 0 && (req.body.type == 'facebook' || req.body.type == 'google') ? '' : req.body.password,
            type: req.body.type,
            name: req.body.name,
            surName: req.body.surName,
            regEmail: req.body.email,
            isGdprConfirmed: req.body.isGdprConfirmed,
            nextPayDate: moment().add(14, 'days').format('YYYY-MM-DD'),
            nextPayDate_ts: moment().add(14, 'days').unix(),
            creditNextPayDate: moment().add(14, 'days').format('YYYY-MM-DD'),
            creditNextPayDate_ts: moment().add(14, 'days').unix(),
            registerDate: moment().format('YYYY-MM-DD'),
            deadtimeExpiration: moment().add(1, 'months').unix()
        }).then(user => {
            return reply.send(msg.signup.ok);
        }).catch(err => {
            console.log(err);
            return reply.send('email' in err.fields ? msg.signup.email : msg.db);
        });
    }).catch(function (errorCodes) {
        console.log(recaptchaAndroid.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/loginApp', { schema: schemas.user, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptchaAndroid.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid', 'password', 'deadtimeExpiration', 'name', 'surName', 'isSmsVerified', 'isEmailVerified', 'banned']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            } else {

                return user.comparePassword(req.body.password).then(authenticated => {
                    if (authenticated) {
                        //if (moment().unix() > user.dataValues['deadtimeExpiration']) {
                        //    return reply.send(msg.expired);
                        //}
                        return db.Sessions.create({
                            ip: req.raw.connection.remoteAddress,
                            uuid: user.dataValues.uuid,
                            lastActivity: moment().unix()
                        }).then(session => {

                            if (!session) {
                                return reply.send(msg.db);
                            } else {
                                var r = msg.authStatus.ok;
                                r['imageName'] = '';
                                r['mimeType'] = '';
                                r['image'] = '';
                                sequelize.query('CALL getUserRating(:uuid)',
                                    {
                                        replacements: {
                                            uuid: user.dataValues.uuid
                                        }
                                    }).then(userRating => {
                                        r['userRating'] = userRating[0].userRating;
                                    }).catch(err => {
                                    });

                                return sequelize.query('CALL getProfileImage(:uuid)',
                                    {
                                        replacements: {
                                            uuid: user.dataValues.uuid
                                        }
                                    }).then(profileImage => {

                                        if (profileImage.length == 0) {
                                            return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, uuid: user.dataValues.uuid, name: user.dataValues.name, surName: user.dataValues.surName, isSmsVerified: user.dataValues.isSmsVerified, isEmailVerified: user.dataValues.isEmailVerified, userRating: r['userRating'], imageName: r['imageName'], mimeType: r['mimeType'], image: r['image'], passwordResetRequired: user.dataValues.passwordResetRequired, banned: user.dataValues.banned });
                                        }

                                        r['imageName'] = profileImage[0].name;
                                        r['mimeType'] = profileImage[0].mimeType;
                                        r['image'] = profileImage[0].content.toString();
                                        return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, uuid: user.dataValues.uuid, name: user.dataValues.name, surName: user.dataValues.surName, isSmsVerified: user.dataValues.isSmsVerified, isEmailVerified: user.dataValues.isEmailVerified, userRating: r['userRating'], imageName: r['imageName'], mimeType: r['mimeType'], image: r['image'], passwordResetRequired: user.dataValues.passwordResetRequired, banned: user.dataValues.banned });
                                    }).catch(err => {
                                        return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, uuid: user.dataValues.uuid, name: user.dataValues.name, surName: user.dataValues.surName, isSmsVerified: user.dataValues.isSmsVerified, isEmailVerified: user.dataValues.isEmailVerified, userRating: r['userRating'], imageName: r['imageName'], mimeType: r['mimeType'], image: r['image'], passwordResetRequired: user.dataValues.passwordResetRequired, banned: user.dataValues.banned });
                                    });

                                //  return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, uuid: user.dataValues.uuid, name: user.dataValues.name, surName: user.dataValues.surName, isSmsVerified: user.dataValues.isSmsVerified, isEmailVerified: user.dataValues.isEmailVerified, userRating: r['userRating'], imageName: r['imageName'], mimeType: r['mimeType'], image: r['image'] });
                            }
                        });
                    } else {
                        return reply.send(msg.login.password);
                    }
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.login.bcrypt);
                });
            }
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/login', { schema: schemas.user, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptcha.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid', 'password', 'deadtimeExpiration', 'name', 'surName', 'isSmsVerified', 'isEmailVerified', 'profileRecommended','passwordResetRequired','banned']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            } else {
              
                return user.comparePassword(req.body.password).then(authenticated => {
                    if (authenticated) {
                        //if (moment().unix() > user.dataValues['deadtimeExpiration']) {
                        //    return reply.send(msg.expired);
                        //}
                        return db.Sessions.create({
                            ip: req.raw.connection.remoteAddress,
                            uuid: user.dataValues.uuid,
                            lastActivity: moment().unix()
                        }).then(session => {

                            if (!session) {
                                return reply.send(msg.db);
                            } else {
                                var r = msg.authStatus.ok;
                                r['imageName'] = '';
                                r['mimeType'] = '';
                                r['image'] = '';
                                sequelize.query('CALL getUserRating(:uuid)',
                                    {
                                        replacements: {
                                            uuid: user.dataValues.uuid
                                        }
                                    }).then(userRating => {
                                        r['userRating'] = userRating[0].userRating;
                                    }).catch(err => {
                                    });

                               return sequelize.query('CALL getProfileImage(:uuid)',
                                    {
                                        replacements: {
                                            uuid: user.dataValues.uuid
                                        }
                                    }).then(profileImage => {

                                        if (profileImage.length == 0) {
                                            return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, uuid: user.dataValues.uuid, name: user.dataValues.name, surName: user.dataValues.surName, isSmsVerified: user.dataValues.isSmsVerified, isEmailVerified: user.dataValues.isEmailVerified, userRating: r['userRating'], imageName: r['imageName'], mimeType: r['mimeType'], image: r['image'], profileRecommended: user.dataValues['profileRecommended'], passwordResetRequired: user.dataValues.passwordResetRequired, banned: user.dataValues.banned });
                                        }

                                        r['imageName'] = profileImage[0].name;
                                        r['mimeType'] = profileImage[0].mimeType;
                                        r['image'] = profileImage[0].content.toString();
                                        return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, uuid: user.dataValues.uuid, name: user.dataValues.name, surName: user.dataValues.surName, isSmsVerified: user.dataValues.isSmsVerified, isEmailVerified: user.dataValues.isEmailVerified, userRating: r['userRating'], imageName: r['imageName'], mimeType: r['mimeType'], image: r['image'], profileRecommended: user.dataValues['profileRecommended'], passwordResetRequired: user.dataValues.passwordResetRequired, banned: user.dataValues.banned });
                                    }).catch(err => {
                                        return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, uuid: user.dataValues.uuid, name: user.dataValues.name, surName: user.dataValues.surName, isSmsVerified: user.dataValues.isSmsVerified, isEmailVerified: user.dataValues.isEmailVerified, userRating: r['userRating'], imageName: r['imageName'], mimeType: r['mimeType'], image: r['image'], profileRecommended: user.dataValues['profileRecommended'], passwordResetRequired: user.dataValues.passwordResetRequired, banned: user.dataValues.banned });
                                    });

                             //  return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, uuid: user.dataValues.uuid, name: user.dataValues.name, surName: user.dataValues.surName, isSmsVerified: user.dataValues.isSmsVerified, isEmailVerified: user.dataValues.isEmailVerified, userRating: r['userRating'], imageName: r['imageName'], mimeType: r['mimeType'], image: r['image'] });
                            }
                        });
                    } else {
                        return reply.send(msg.login.password);
                    }
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.login.bcrypt);
                });
            }
            }).catch(err => {
                console.log(err);
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/resetPassword', { schema: schemas.resetPassword, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptcha.validate(req.body.recaptcha).then(function () {
        var confirmationEmail = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid']
        }).then(user => {
            if (!user) {
                return reply.send(msg.password.notexist);
            }
            return db.Users.update({
                confirmEmailRequest: false,
                confirmationEmail: confirmationEmail,
                confirmEmailExpiry: moment().unix()
            }, {
                where: {
                    email: req.body.email
                }
            }).then(user => {
                return reply.send(msg.password.email);
            }).catch(err => {
                return reply.send(msg.db);
            });
        }).catch(function (errorCodes) {
            //console.log(recaptcha.translateErrors(errorCodes));
            return reply.send(msg.captcha);
        });
    });

});
server.post('/resetPasswordApp', { schema: schemas.resetPassword, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptchaAndroid.validate(req.body.recaptcha).then(function () {
        var confirmationEmail = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid']
        }).then(user => {
            if (!user) {
                return reply.send(msg.password.notexist);
            }
            return db.Users.update({
                confirmEmailRequest: false,
                confirmationEmail: confirmationEmail,
                confirmEmailExpiry: moment().unix()
            }, {
                    where: {
                        email: req.body.email
                    }
                }).then(user => {
                    return reply.send(msg.password.email);
                }).catch(err => {
                    return reply.send(msg.db);
                });
        }).catch(function (errorCodes) {
            //console.log(recaptcha.translateErrors(errorCodes));
            return reply.send(msg.captcha);
        });
    });

});
server.post('/emailVerifyRequest', { schema: schemas.emailVerifyRequest, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptcha.validate(req.body.recaptcha).then(function () {
        var confirmationEmail = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid']
        }).then(user => {
            if (!user) {
                return reply.send(msg.password.notexist);
            }
            return db.Users.update({
                confirmEmailRequest: true,
                confirmationEmail: confirmationEmail,
                confirmEmailExpiry: moment().unix()
            }, {
                    where: {
                        email: req.body.email
                    }
                }).then(user => {
                    return reply.send(msg.password.verify);
                }).catch(err => {
                    return reply.send(msg.db);
                });
        }).catch(function (errorCodes) {
            //console.log(recaptcha.translateErrors(errorCodes));
            return reply.send(msg.captcha);
        });
    });

});
server.post('/emailVerifyRequestApp', { schema: schemas.emailVerifyRequest, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptchaAndroid.validate(req.body.recaptcha).then(function () {
        var confirmationEmail = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid']
        }).then(user => {
            if (!user) {
                return reply.send(msg.password.notexist);
            }
            return db.Users.update({
                confirmEmailRequest: true,
                confirmationEmail: confirmationEmail,
                confirmEmailExpiry: moment().unix()
            }, {
                    where: {
                        email: req.body.email
                    }
                }).then(user => {
                    return reply.send(msg.password.verify);
                }).catch(err => {
                    return reply.send(msg.db);
                });
        }).catch(function (errorCodes) {
            //console.log(recaptcha.translateErrors(errorCodes));
            return reply.send(msg.captcha);
        });
    });

});
server.post('/emailVerify', { schema: schemas.emailVerify, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptcha.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid', 'confirmationEmail']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            }
            if (user.dataValues.confirmationEmail !== req.body.confirmationEmail) {
                return reply.send(msg.password.confirmation);
            }
          
            return db.Users.update({
                confirmEmailRequest: false,
                isEmailVerified: true,
                confirmationEmail: null,
                confirmEmailExpiry: null
            }, {
                    where: {
                        uuid: user.dataValues.uuid,
                        email: req.body.email,
                        confirmationEmail: req.body.confirmationEmail
                    },
                    individualHooks: true
            }).then(user => {
                return reply.send(msg.password.confirmed);
            }).catch(err => {
                return reply.send(msg.db);
            });
            return reply.send(msg.db);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/emailVerifyApp', { schema: schemas.emailVerify, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptchaAndroid.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid', 'confirmationEmail']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            }
            if (user.dataValues.confirmationEmail !== req.body.confirmationEmail) {
                return reply.send(msg.password.confirmation);
            }

            return db.Users.update({
                confirmEmailRequest: false,
                isEmailVerified: true,
                confirmationEmail: null,
                confirmEmailExpiry: null
            }, {
                    where: {
                        uuid: user.dataValues.uuid,
                        email: req.body.email,
                        confirmationEmail: req.body.confirmationEmail
                    },
                    individualHooks: true
                }).then(user => {
                    return reply.send(msg.password.confirmed);
                }).catch(err => {
                    return reply.send(msg.db);
                });
            return reply.send(msg.db);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/smsVerifyRequest', { schema: schemas.smsVerifyRequest, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptcha.validate(req.body.recaptcha).then(function () {
        var confirmationSms = Math.random().toString(10).substring(2, 4) + Math.random().toString(10).substring(2, 6);
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid
            },
            attributes: ['uuid']
        }).then(user => {
            if (!user) {
                return reply.send(msg.sms.uuid);
            }
            return db.Users.update({
                confirmViberRequest: false,
                confirmWhatsAppRequest:false,
                confirmationSms: confirmationSms,
                telephone: req.body.telephone,
                isSmsVerified: false,
                confirmSmsExpiry: moment().unix()
            }, {
                    where: {
                        uuid: req.body.uuid
                    }
                }).then(user => {
                    return reply.send(msg.sms.sms);
                }).catch(err => {
                    return reply.send(msg.db);
                });
        }).catch(function (errorCodes) {
            //console.log(recaptcha.translateErrors(errorCodes));
            return reply.send(msg.captcha);
        });
    });

});
server.post('/smsVerifyRequestApp', { schema: schemas.smsVerifyRequest, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptchaAndroid.validate(req.body.recaptcha).then(function () {
        var confirmationSms = Math.random().toString(10).substring(2, 4) + Math.random().toString(10).substring(2, 6);
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid
            },
            attributes: ['uuid']
        }).then(user => {
            if (!user) {
                return reply.send(msg.sms.uuid);
            }
            return db.Users.update({
                confirmViberRequest: false,
                confirmWhatsAppRequest: false,
                confirmationSms: confirmationSms,
                telephone: req.body.telephone,
                isSmsVerified: false,
                confirmSmsExpiry: moment().unix()
            }, {
                    where: {
                        uuid: req.body.uuid
                    }
                }).then(user => {
                    return reply.send(msg.sms.sms);
                }).catch(err => {
                    return reply.send(msg.db);
                });
        }).catch(function (errorCodes) {
            //console.log(recaptcha.translateErrors(errorCodes));
            return reply.send(msg.captcha);
        });
    });

});
server.post('/smsViberVerifyRequest', { schema: schemas.smsViberVerifyRequest, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptcha.validate(req.body.recaptcha).then(function () {
        var confirmationSms = Math.random().toString(10).substring(2, 4) + Math.random().toString(10).substring(2, 6);
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid
            },
            attributes: ['uuid']
        }).then(user => {
            if (!user) {
                return reply.send(msg.sms.uuid);
            }
            return db.Users.update({
                confirmViberRequest: true,
                confirmWhatsAppRequest: false,
                confirmationSms: confirmationSms,
                viber: req.body.viber,
                isViberVerified: false,
                confirmSmsExpiry: moment().unix()
            }, {
                    where: {
                        uuid: req.body.uuid
                    }
                }).then(user => {
                    return reply.send(msg.sms.sms);
                }).catch(err => {
                    return reply.send(msg.db);
                });
        }).catch(function (errorCodes) {
            //console.log(recaptcha.translateErrors(errorCodes));
            return reply.send(msg.captcha);
        });
    });
});
server.post('/smsWhatsAppVerifyRequest', { schema: schemas.smsWhatsAppVerifyRequest, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return recaptcha.validate(req.body.recaptcha).then(function () {
        var confirmationSms = Math.random().toString(10).substring(2, 4) + Math.random().toString(10).substring(2, 6);
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid
            },
            attributes: ['uuid']
        }).then(user => {
            if (!user) {
                return reply.send(msg.sms.uuid);
            }
            return db.Users.update({
                confirmViberRequest: false,
                confirmWhatsAppRequest: true,
                confirmationSms: confirmationSms,
                whatsApp: req.body.whatsApp,
                isWhatsAppVerified: false,
                confirmSmsExpiry: moment().unix()
            }, {
                    where: {
                        uuid: req.body.uuid
                    }
                }).then(user => {
                    return reply.send(msg.sms.sms);
                }).catch(err => {
                    return reply.send(msg.db);
                });
        }).catch(function (errorCodes) {
            //console.log(recaptcha.translateErrors(errorCodes));
            return reply.send(msg.captcha);
        });
    });

});

server.post('/newPassword', { schema: schemas.newPassword, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptcha.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid', 'confirmationEmail']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            }
            if (user.dataValues.confirmationEmail !== req.body.confirmationEmail) {
                return reply.send(msg.password.confirmation);
            }
            if ('password' in req.body && req.body.password.length > 5) {
                return db.Users.update({
                    password: req.body.password,
                    passwordResetRequired: false,
                    isEmailVerified: true,
                    confirmationEmail: null,
                    confirmEmailExpiry: null
                }, {
                    where: {
                        uuid: user.dataValues.uuid,
                        email: req.body.email,
                        confirmationEmail: req.body.confirmationEmail
                    },
                    individualHooks: true
                }).then(user => {
                    return reply.send(msg.password.ok);
                }).catch(err => {
                    return reply.send(msg.db);
                });
            }
            return reply.send(msg.password.error);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/newPasswordApp', { schema: schemas.newPassword, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptchaAndroid.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                email: req.body.email
            },
            attributes: ['uuid', 'confirmationEmail']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            }
            if (user.dataValues.confirmationEmail !== req.body.confirmationEmail) {
                return reply.send(msg.password.confirmation);
            }
            if ('password' in req.body && req.body.password.length > 5) {
                return db.Users.update({
                    password: req.body.password,
                    passwordResetRequired: false,
                    isEmailVerified: true,
                    confirmationEmail: null,
                    confirmEmailExpiry: null
                }, {
                        where: {
                            uuid: user.dataValues.uuid,
                            email: req.body.email,
                            confirmationEmail: req.body.confirmationEmail
                        },
                        individualHooks: true
                    }).then(user => {
                        return reply.send(msg.password.ok);
                    }).catch(err => {
                        return reply.send(msg.db);
                    });
            }
            return reply.send(msg.password.error);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/checkSmsCode', { schema: schemas.checkSmsCode, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptcha.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid
            },
            attributes: ['uuid', 'confirmationSms']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            }
            if (user.dataValues.confirmationSms !== req.body.confirmationSms || req.body.confirmationSms.length !== 6  ) {
                return reply.send(msg.sms.confirmation);
            }
            return db.Users.update({
                confirmViberRequest: false,
                confirmWhatsAppRequest: false,
                isSmsVerified: true,
                confirmationSms: null,
                confirmSmsExpiry: null
            }, {
                where: {
                    uuid: user.dataValues.uuid,
                    confirmationSms: req.body.confirmationSms
                },
                individualHooks: true
            }).then(user => {
                return reply.send(msg.sms.confirmationOk);
            }).catch(err => {
                return reply.send(msg.db);
            });
           
            return reply.send(msg.sms.confirmation);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/checkSmsCodeApp', { schema: schemas.checkSmsCode, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptchaAndroid.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid
            },
            attributes: ['uuid', 'confirmationSms']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            }
            if (user.dataValues.confirmationSms !== req.body.confirmationSms || req.body.confirmationSms.length !== 6) {
                return reply.send(msg.sms.confirmation);
            }
            return db.Users.update({
                confirmViberRequest: false,
                confirmWhatsAppRequest: false,
                isSmsVerified: true,
                confirmationSms: null,
                confirmSmsExpiry: null
            }, {
                    where: {
                        uuid: user.dataValues.uuid,
                        confirmationSms: req.body.confirmationSms
                    },
                    individualHooks: true
                }).then(user => {
                    return reply.send(msg.sms.confirmationOk);
                }).catch(err => {
                    return reply.send(msg.db);
                });

            return reply.send(msg.sms.confirmation);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/checkViberSmsCode', { schema: schemas.checkViberSmsCode, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptcha.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid
            },
            attributes: ['uuid', 'confirmationSms']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            }
            if (user.dataValues.confirmationSms !== req.body.confirmationSms || req.body.confirmationSms.length !== 6) {
                return reply.send(msg.sms.confirmation);
            }
            return db.Users.update({
                confirmViberRequest: false,
                confirmWhatsAppRequest: false,
                isViberVerified: true,
                confirmationSms: null,
                confirmSmsExpiry: null
            }, {
                    where: {
                        uuid: user.dataValues.uuid,
                        confirmationSms: req.body.confirmationSms,
                        confirmViberRequest: true
                    },
                    individualHooks: true
            }).then(user => {
                return reply.send(msg.sms.confirmationOk);
            }).catch(err => {
                return reply.send(msg.db);
            });

            return reply.send(msg.sms.confirmation);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});
server.post('/checkWhatsAppSmsCode', { schema: schemas.checkWhatsAppSmsCode, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    recaptcha.validate(req.body.recaptcha).then(function () {
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid
            },
            attributes: ['uuid', 'confirmationSms']
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            }
            if (user.dataValues.confirmationSms !== req.body.confirmationSms || req.body.confirmationSms.length !== 6) {
                return reply.send(msg.sms.confirmation);
            }
            return db.Users.update({
                confirmViberRequest: false,
                confirmWhatsAppRequest: false,
                isWhatsAppVerified: true,
                confirmationSms: null,
                confirmSmsExpiry: null
            }, {
                    where: {
                        uuid: user.dataValues.uuid,
                        confirmationSms: req.body.confirmationSms,
                        confirmWhatsAppRequest: true
                    },
                    individualHooks: true
                }).then(user => {
                    return reply.send(msg.sms.confirmationOk);
                }).catch(err => {
                    return reply.send(msg.db);
                });

            return reply.send(msg.sms.confirmation);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }).catch(function (errorCodes) {
        //console.log(recaptcha.translateErrors(errorCodes));
        return reply.send(msg.captcha);
    });
});

server.post('/logout', { schema: schemas.auth, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: ['uuid'],
        required: true
      }]
    }).then(session => {
      if (!session) {
        return reply.send(msg.auth);
      }
      return db.Sessions.destroy({
        where: {
          session: req.body.session,
          ip: req.raw.connection.remoteAddress
        }
      }).then(rows => {
        if (rows < 1) {
          return reply.send(msg.db);
        }
        return reply.send(msg.logout);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/authStatus', { schema: schemas.authStatus, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
        include: [{
            model: db.Users,
            attributes: ['isAdmin', 'deadtimeExpiration', 'groupId', 'uuid', 'name', 'surName', 'isSmsVerified', 'isEmailVerified', 'profileRecommended','passwordResetRequired','banned'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions.dataValues.user) {
        return reply.send(msg.auth);
      //} else if (moment().unix() > sessions.dataValues.user.dataValues['deadtimeExpiration']) {
      //  return reply.send(msg.expired);
      }

      var r = msg.authStatus.ok;
      r['uuid'] = sessions.dataValues.user.dataValues['uuid'];
      r['isAdmin'] = sessions.dataValues.user.dataValues['isAdmin'];
      r['groupId'] = sessions.dataValues.user.dataValues['groupId'];
      r['banned'] = sessions.dataValues.user.dataValues['banned'];
      r['name'] = sessions.dataValues.user.dataValues['name'];
      r['surName'] = sessions.dataValues.user.dataValues['surName'];
      r['isSmsVerified'] = sessions.dataValues.user.dataValues['isSmsVerified'];
      r['isEmailVerified'] = sessions.dataValues.user.dataValues['isEmailVerified'];
      r['imageName'] = '';
      r['mimeType'] = '';
      r['image'] = '';
      r['profileRecommended'] = sessions.dataValues.user.dataValues['profileRecommended'];
        r['passwordResetRequired'] = sessions.dataValues.user.dataValues['passwordResetRequired'];

        sequelize.query('CALL getUserRating(:uuid)',
            {
                replacements: {
                    uuid: sessions.dataValues.user.dataValues['uuid']
                }
            }).then(userRating => {
                r['userRating'] = userRating[0].userRating;
            }).catch(err => {
            });
         
        return sequelize.query('CALL getProfileImage(:uuid)',
            {
                replacements: {
                    uuid: sessions.dataValues.user.dataValues['uuid']
                }
            }).then(profileImage => {
              
                if (profileImage.length == 0) {
                    return reply.send(r);
                }

                r['imageName'] = profileImage[0].name;
                r['mimeType'] = profileImage[0].mimeType;
                r['image'] = profileImage[0].content.toString();
                return reply.send(r);
            }).catch(err => {
                return reply.send(r);
            });
       // return reply.send(r);
    }).catch(err => {
        return reply.send(msg.auth);
    });
  }
  return reply.send(msg.auth);
});




//lists
server.get('/getContributionType', { schema: schemas.getContributionType, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    return db.ContributionsTypeList.findAll({
        raw: true,
        attributes: [
            'id',
            'name'
        ]
    }).then(contributions => {
        return reply.send({ result: 1, contributions: contributions });
    });
    return reply.send(msg.auth);
});
server.get('/getAppSettings', { schema: schemas.getAppSettings, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return db.AppSettings.findAll({
        raw: true,
        attributes: [
            'id',
            'paramName',
            'value'
        ]
    }).then(appSettings => {
        return reply.send({ result: 1, appSettings: appSettings });
    });
    return reply.send(msg.auth);
});
server.get('/getCurrency', { schema: schemas.getCurrency, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    return sequelize.query('CALL getCurrency()').then(currencies => {
        return reply.send({ result: 1, currencies: currencies });
    });
    return reply.send(msg.auth);
});
server.get('/getTags', { schema: schemas.getTags, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    return db.TagList.findAll({
        raw: true,
        attributes: [
            'id',
            'tag',
            'creator_uuid'
        ]
    }).then(tags => {
        return reply.send({ result: 1, tags: tags });
    });
    return reply.send(msg.auth);
});
server.get('/getPhoneCodes', { schema: schemas.getPhoneCodes, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    return db.PhoneCodes.findAll({
        raw: true,
        attributes: [
            'shortCountry',
            'country',
            'code'
        ]
    }).then(codes => {
        return reply.send({ result: 1, codes: codes });
    });
    return reply.send(msg.auth);
});


// data part
server.post('/getById', { schema: schemas.getById, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return db.Contributions.findAll({
        where: {
            id: req.body.contributionId,
            deleted: false
        },
        raw: true,
        attributes: [
            'uuid', 'title', 'type', 'content', 'capacityFrom', 'capacityTo', 'price', 'currency', 'actionDatetime', 'gpsLocation', 'created', 'actionDatetime', 'streetAcp', 'postCode', 'city', 'priceFree', 'priceOwner', 'isPublished', 'insertPaymentRequired', 'insertPaymentPrice', 'videoUrl', 'distance', 'privateAddress', 'platform'
            , [Sequelize.literal('IFNULL((SELECT CONCAT(`users`.`name`,\' \',`users`.`surName`) FROM `users` WHERE `users`.`uuid` = `contribution`.`uuid`),\'\')'), 'authorName']
            , [Sequelize.literal('(SELECT GROUP_CONCAT(`tl`.`tag` SEPARATOR \'||\') FROM `tag_list` tl,`tag_using` tu WHERE `tu`.`tag_id` = `tl`.`id` AND `tu`.`contribution_id` = `contribution`.`id` GROUP BY `tu`.`contribution_id`)'), 'tags']
            , [Sequelize.literal('(SELECT `a`.`content` FROM `attachments` a WHERE `a`.`contribution_id` = `contribution`.`id` AND `a`.`primaryAttachment` = TRUE)'), 'primaryAttachment']
        ]
    }).then(contribution => {
        if (contribution.length == 0) {
            return reply.send({ result: 0, code: 'none-record', contribution: contribution });
        }
        if (contribution[0].privateAddress) {
            contribution[0].gpsLocation = 0;
            contribution[0].streetAcp = 0;
        }
        return reply.send({ result: 1, code: 'get-ok', contribution: contribution });
    }).catch(err => {
        console.log(err);

        return reply.send(msg.db);
    });
    return reply.send(msg.db);
});
server.post('/getAdvertisement', { schema: schemas.getAdvertisement, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return sequelize.query('CALL getAdvertisement(:orderBy)', {
        replacements: {
            orderBy: req.body.orderBy
        }
    }).then(advertisements => {
        return reply.send({ result: 1, advertisements: advertisements });
    });
    return reply.send(msg.auth);
});

server.post('/phoneNumberAllowed', { schema: schemas.phoneNumberAllowed, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL phoneNumberAllowed(:uuid,:phoneNumber)',
            {
                replacements: {
                    uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                    phoneNumber: req.body.phoneNumber
                }
            }).then(status => {
                return reply.send({ result: 1, code: 'get-ok', status: status[0].status });
            });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setPayment', { schema: schemas.setPayment, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36 && req.body.ownerUuid.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return db.ContributionPayments.create({
                owner_uuid: req.body.ownerUuid,
                contribution_id: req.body.contributionId,
                price: req.body.price,
                currency: req.body.currency

            }).then(done => {
                return reply.send({ result: 1, code: 'set-ok', message: 'payment was created', done: true });
            }).catch(err => {
                console.log(err);
                return reply.send(msg.db);
            });

        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }

    return reply.send(msg.auth);
});
server.post('/getPayment', { schema: schemas.getPayment, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36 && req.body.ownerUuid.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return db.ContributionPayments.findAll({
                where: {
                    owner_uuid: req.body.ownerUuid,
                    contribution_id: req.body.contributionId
                },
                raw: true,
                attributes: [
                    ['owner_uuid', 'ownerUuid'], ['contribution_id', 'contributionId'], 'price', 'payed', 'created', 'checkout_url', 'currency', 'status', 'nonce'
                ]
            }).then(payment => {
                return reply.send({ result: 1, code: 'get-ok', payment: payment });
            }).catch(err => {
                console.log(err);
                return reply.send(msg.db);
            });

        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }

    return reply.send(msg.auth);
});
server.post('/getAcceptationById', { schema: schemas.getAcceptationById, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return db.CandidateAcceptation.findAll({
                where: {
                    contribution_id: req.body.contributionId,
                    candidate_id: req.body.candidateId,
                    reserved: true
                },
                raw: true,
                attributes: [
                    'price', 'acceptationDatetime', 'streetAcp', 'postCode', 'city', 'gpsLocation', 'platform',
                    [Sequelize.col('contribution.title'), 'title'], [Sequelize.col('contribution.currency'), 'currency'], [Sequelize.col('contribution.link'), 'link'], [Sequelize.col('contribution.facebook'), 'facebook'], [Sequelize.col('contribution.onlineAddress'), 'onlineAddress']
                ],
                include: [{
                    model: db.Contributions,
                    attributes: [],
                    required: true
                }]
            }).then(acceptation => {
                return reply.send({ result: 1, code: 'get-ok', acceptation: acceptation });
            }).catch(err => {
                console.log(err);
                return reply.send(msg.db);
            });

        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }

    return reply.send(msg.auth);
});
server.post('/setAttachments', { schema: schemas.setAttachments, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setAttachments(:name,:mimeType,:content,:uuid,:contributionId,:primaryAttachment)',
                {
                    replacements: {
                        name: req.body.name,
                        mimeType: req.body.mimeType,
                        content: req.body.content,
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : (req.body.contributionId == null) ? sessions.user.dataValues.uuid : null,
                        contributionId: (req.body.contributionId) ? req.body.contributionId : null ,
                        primaryAttachment: (req.body.primaryAttachment) ? req.body.primaryAttachment : 0
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'set-ok', done: done });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
        return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/removeAttachment', { schema: schemas.removeAttachment, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL removeAttachment(:uuid,:contributionId,:id,:primaryAttachment)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        contributionId: req.body.contributionId,
                        id: (req.body.id) ? req.body.id : null ,
                        primaryAttachment: (req.body.primaryAttachment) ? req.body.primaryAttachment : 0
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'set-ok', done: done });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/removeContribution', { schema: schemas.removeContribution, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL removeContribution(:uuid,:contributionId,:isAdmin)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        contributionId: req.body.contributionId,
                        isAdmin: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? sessions.user.dataValues.isAdmin : false
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'set-ok', done: done });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getAttachment', { schema: schemas.getAttachment, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    return sequelize.query('CALL getAttachment(:id)',
        {
            replacements: {
                id: req.body.id
            }
        }).then(attachment => {
            return reply.send({ result: 1, code: 'set-ok', name: attachment[0].name, mimeType: attachment[0].mimeType, content: attachment[0].content.toString() });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
});
server.post('/getNotifications', { schema: schemas.getNotifications, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL getNotifications(:uuid,:countNo,:pageNo)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        countNo: req.body.countNo,
                        pageNo: req.body.pageNo
                    }
                }).then(notifications => {
                    return reply.send({ result: 1, code: 'set-ok', notifications: notifications });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setContributions', { schema: schemas.setContributions, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setContributions(:id,:uuid,:title,:type,:content,:durations,:capacityFrom,:capacityTo,:price,:currency,:tags,:actionDatetime,:gpsLocation,:streetAcp,:postCode,:city,:priceFree,:priceOwner,:isPublished,:insertPaymentRequired,:insertPaymentPrice,:videoUrl,:distance,:moveContribId,:candidateId,:privateAddress,:platform,:skype,:skypeDirect,:viber,:viberDirect,:facebook,:facebookDirect,:hangouts,:hangoutsDirect,:whatsApp,:whatsAppDirect,:emailDirect,:phoneDirect,:link,:linkDirect,:onlineAddress,:onlineAddressDirect,:priceNote,:facebookContact,:isAdmin)',
                {
                    replacements: {
                        id: req.body.id,
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        title: req.body.title,
                        type: req.body.type,
                        content: req.body.content,
                        durations: (req.body.durations) ? req.body.durations : null,
                        capacityFrom: (req.body.capacityFrom) ? req.body.capacityFrom : null,
                        capacityTo: (req.body.capacityTo) ? req.body.capacityTo : null,
                        price: req.body.price,
                        currency: req.body.currency,
                        tags: req.body.tags,
                        actionDatetime: (req.body.actionDatetime) ? req.body.actionDatetime : null ,
                        gpsLocation: (req.body.gpsLocation) ? req.body.gpsLocation : null,
                        streetAcp: (req.body.streetAcp) ? req.body.streetAcp : null,
                        postCode: (req.body.postCode) ? req.body.postCode : null,
                        city: (req.body.city) ? req.body.city : null,
                        priceFree: (req.body.priceFree) ? req.body.priceFree : null,
                        priceOwner: (req.body.priceOwner) ? req.body.priceOwner : null,
                        isPublished: (req.body.isPublished) ? req.body.isPublished : null,
                        insertPaymentRequired: (req.body.insertPaymentRequired) ? req.body.insertPaymentRequired : null,
                        insertPaymentPrice: (req.body.insertPaymentPrice) ? req.body.insertPaymentPrice : null,
                        videoUrl: (req.body.videoUrl) ? req.body.videoUrl : null,
                        distance: (req.body.distance) ? req.body.distance : null,
                        moveContribId: (req.body.moveContribId) ? req.body.moveContribId : null,
                        candidateId: (req.body.candidateId) ? req.body.candidateId : null,
                        privateAddress: (req.body.privateAddress) ? req.body.privateAddress : 0,
                        platform: (req.body.platform) ? req.body.platform : null,
                        skype: (req.body.skype) ? req.body.skype : null,
                        skypeDirect: (req.body.skypeDirect) ? req.body.skypeDirect : 0,
                        viber: (req.body.viber) ? req.body.viber : null,
                        viberDirect: (req.body.viberDirect) ? req.body.viberDirect : 0,
                        facebook: (req.body.facebook) ? req.body.facebook : null,
                        facebookDirect: (req.body.facebookDirect) ? req.body.facebookDirect : 0,
                        hangouts: (req.body.hangouts) ? req.body.hangouts : null,
                        hangoutsDirect: (req.body.hangoutsDirect) ? req.body.hangoutsDirect : 0,
                        whatsApp: (req.body.whatsApp) ? req.body.whatsApp : null,
                        whatsAppDirect: (req.body.whatsAppDirect) ? req.body.whatsAppDirect : 0,
                        emailDirect: (req.body.emailDirect) ? req.body.emailDirect : 0,
                        phoneDirect: (req.body.phoneDirect) ? req.body.phoneDirect : 0,
                        link: (req.body.link) ? req.body.link : null,
                        linkDirect: (req.body.linkDirect) ? req.body.linkDirect : 0,
                        onlineAddress: (req.body.onlineAddress) ? req.body.onlineAddress : null,
                        onlineAddressDirect: (req.body.onlineAddressDirect) ? req.body.onlineAddressDirect : 0,
                        priceNote: (req.body.priceNote) ? req.body.priceNote : null,
                        facebookContact: (req.body.facebookContact) ? req.body.facebookContact : '',
                        isAdmin: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? sessions.user.dataValues.isAdmin : false
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'set-ok', done: done[0].done, id: done[0].id });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getContributions', { schema: schemas.getContributions, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            
            return sequelize.query('CALL getContributions(:callerUuid,:uuid,:full,:getInterests,:myInterest,:countNo,:pageNo,:contrType,:priceFrom,:priceTo,:timeFrom,:timeTo,:dateFrom,:dateTo,:orderBy,:datedContributions,:currency,:fullTextFilter,:filterType,:getUnpublished,:locationRange,:priceFree,:withActionDateOnly,:contributionId,:platform,:orderBySec,:onlyWithDirectContact,:actual)',
                {
                    replacements: {
                        callerUuid: sessions.user.dataValues.isAdmin && 'callerUuid' in req.body && req.body.callerUuid.length === 36 ? req.body.callerUuid : sessions.user.dataValues.uuid,
                        uuid: req.body.uuid,
                        full: req.body.full,
                        myInterest: req.body.myInterest,
                        getInterests: req.body.getInterests,
                        countNo: req.body.countNo,
                        pageNo: req.body.pageNo,
                        contrType: (req.body.contrType) ? req.body.contrType : null,
                        priceFrom: (req.body.priceFrom) ? req.body.priceFrom : null,
                        priceTo: (req.body.priceTo) ? req.body.priceTo : null,
                        timeFrom: (req.body.timeFrom) ? req.body.timeFrom : null,
                        timeTo: (req.body.timeTo) ? req.body.timeTo : null,
                        dateFrom: (req.body.dateFrom) ? req.body.dateFrom : null,
                        dateTo: (req.body.dateTo) ? req.body.dateTo : null,
                        orderBy: (req.body.orderBy) ? req.body.orderBy : null,
                        datedContributions: (req.body.datedContributions) ? req.body.datedContributions : false,
                        currency: (req.body.currency) ? req.body.currency : null,
                        fullTextFilter: (req.body.fullTextFilter) ? req.body.fullTextFilter : null,
                        filterType: (req.body.filterType) ? req.body.filterType : 'AND',
                        getUnpublished: (req.body.getUnpublished) ? req.body.getUnpublished : false,
                        locationRange: (req.body.locationRange) ? req.body.locationRange : null,
                        priceFree: (req.body.priceFree) ? req.body.priceFree : null,
                        withActionDateOnly: (req.body.withActionDateOnly) ? req.body.withActionDateOnly : null,
                        contributionId: (req.body.contributionId) ? req.body.contributionId : null,
                        platform: (req.body.platform) ? req.body.platform : null,
                        orderBySec: (req.body.orderBySec) ? req.body.orderBySec : null,
                        onlyWithDirectContact: (req.body.onlyWithDirectContact) ? req.body.onlyWithDirectContact : null,
                        actual: (req.body.actual) ? req.body.actual : false
                    }
                }).then(contributions => {
                    return reply.send({ result: 1, code: 'get-ok', contributions: contributions });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    } else {
        //console.log("request received");
        return sequelize.query('CALL getContributions(:callerUuid,:uuid,:full,:getInterests,:myInterest,:countNo,:pageNo,:contrType,:priceFrom,:priceTo,:timeFrom,:timeTo,:dateFrom,:dateTo,:orderBy,:datedContributions,:currency,:fullTextFilter,:filterType,:getUnpublished,:locationRange,:priceFree,:withActionDateOnly,:contributionId,:platform,:orderBySec,:onlyWithDirectContact,:actual)',
            {
                replacements: {
                    callerUuid: '',
                    uuid: (req.body.uuid) ? req.body.uuid : null,
                    full: req.body.full,
                    getInterests: req.body.getInterests,
                    myInterest: req.body.myInterest,
                    countNo: req.body.countNo,
                    pageNo: req.body.pageNo,
                    contrType: (req.body.contrType) ? req.body.contrType : null,
                    priceFrom: (req.body.priceFrom) ? req.body.priceFrom : null,
                    priceTo: (req.body.priceTo) ? req.body.priceTo : null,
                    timeFrom: (req.body.timeFrom) ? req.body.timeFrom : null,
                    timeTo: (req.body.timeTo) ? req.body.timeTo : null,
                    dateFrom: (req.body.dateFrom) ? req.body.dateFrom : null,
                    dateTo: (req.body.dateTo) ? req.body.dateTo : null,
                    orderBy: (req.body.orderBy) ? req.body.orderBy : null,
                    datedContributions: (req.body.datedContributions) ? req.body.datedContributions : false,
                    currency: (req.body.currency) ? req.body.currency : null,
                    fullTextFilter: (req.body.fullTextFilter) ? req.body.fullTextFilter : null,
                    filterType: (req.body.filterType) ? req.body.filterType : 'AND',
                    getUnpublished: false,
                    locationRange: (req.body.locationRange) ? req.body.locationRange : null,
                    priceFree: (req.body.priceFree) ? req.body.priceFree : null,
                    withActionDateOnly: (req.body.withActionDateOnly) ? req.body.withActionDateOnly : null,
                    contributionId: (req.body.contributionId) ? req.body.contributionId : null,
                    platform: (req.body.platform) ? req.body.platform : null,
                    orderBySec: (req.body.orderBySec) ? req.body.orderBySec : null,
                    onlyWithDirectContact: (req.body.onlyWithDirectContact) ? req.body.onlyWithDirectContact : null,
                    actual: (req.body.actual) ? req.body.actual : false
                }
            }).then(contributions => {
                //console.log("request ansvered");
                return reply.send({result: 1, code: 'get-ok', contributions: contributions});
            }).catch(err => {
                console.log(err);
                return reply.send(msg.db);
            });
    }
    return reply.send(msg.auth);
});
server.post('/getFavorites', { schema: schemas.getFavorites, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }

            return sequelize.query('CALL getFavorites(:callerUuid,:uuid,:countNo,:pageNo,:contrType,:priceFrom,:priceTo,:timeFrom,:timeTo,:dateFrom,:dateTo,:orderBy,:currency,:fullTextFilter,:filterType,:locationRange,:priceFree,:withActionDateOnly,:contributionId,:platform,:orderBySec,:onlyWithDirectContact)',
                {
                    replacements: {
                        callerUuid: sessions.user.dataValues.isAdmin && 'callerUuid' in req.body && req.body.callerUuid.length === 36 ? req.body.callerUuid : sessions.user.dataValues.uuid,
                        uuid: req.body.uuid,
                        countNo: req.body.countNo,
                        pageNo: req.body.pageNo,
                        contrType: (req.body.contrType) ? req.body.contrType : null,
                        priceFrom: (req.body.priceFrom) ? req.body.priceFrom : null,
                        priceTo: (req.body.priceTo) ? req.body.priceTo : null,
                        timeFrom: (req.body.timeFrom) ? req.body.timeFrom : null,
                        timeTo: (req.body.timeTo) ? req.body.timeTo : null,
                        dateFrom: (req.body.dateFrom) ? req.body.dateFrom : null,
                        dateTo: (req.body.dateTo) ? req.body.dateTo : null,
                        orderBy: (req.body.orderBy) ? req.body.orderBy : null,
                        currency: (req.body.currency) ? req.body.currency : null,
                        fullTextFilter: (req.body.fullTextFilter) ? req.body.fullTextFilter : null,
                        filterType: (req.body.filterType) ? req.body.filterType : 'AND',
                        locationRange: (req.body.locationRange) ? req.body.locationRange : null,
                        priceFree: (req.body.priceFree) ? req.body.priceFree : null,
                        withActionDateOnly: (req.body.withActionDateOnly) ? req.body.withActionDateOnly : null,
                        contributionId: (req.body.contributionId) ? req.body.contributionId : null,
                        platform: (req.body.platform) ? req.body.platform : null,
                        orderBySec: (req.body.orderBySec) ? req.body.orderBySec : null,
                        onlyWithDirectContact: (req.body.onlyWithDirectContact) ? req.body.onlyWithDirectContact : null,
                    }
                }).then(contributions => {
                    return reply.send({ result: 1, code: 'get-ok', contributions: contributions });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getMyAcceptations', { schema: schemas.getMyAcceptations, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36 && req.body.uuid.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }

            return sequelize.query('CALL getMyAcceptations(:uuid)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
                    }
                }).then(acceptations => {
                    return reply.send({ result: 1, code: 'get-ok', acceptations: acceptations });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getAuthorInterestsTimes', { schema: schemas.getAuthorInterestsTimes, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36 && req.body.uuid.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }

            return sequelize.query('CALL getAuthorInterestsTimes(:uuid)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
                    }
                }).then(acceptations => {
                    return reply.send({ result: 1, code: 'get-ok', acceptations: acceptations });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setRating', { schema: schemas.setRating, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid', 'isAdmin'],
                where: {
                    banned: false
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setRating(:uuid,:authorUuid,:id,:candidateId,:rating,:type)',
                {
                    replacements: {
                        uuid: req.body.uuid,
                        authorUuid: sessions.user.dataValues.isAdmin && 'authorUuid' in req.body && req.body.authorUuid.length === 36 ? req.body.authorUuid : sessions.user.dataValues.uuid,
                        id: req.body.id,
                        candidateId: req.body.candidateId,
                        rating: req.body.rating,
                        type: req.body.type
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'get-ok', done: done });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setContributionLike', { schema: schemas.setContributionLike, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid', 'isAdmin'],
                where: {
                    banned: false
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setContributionLike(:uuid,:id)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        id: req.body.id
                    }
                }).then(like => {
                    return reply.send({ result: 1, code: 'get-ok', like: like });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setUserLike', { schema: schemas.setUserLike, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid', 'isAdmin'],
                where: {
                    banned: false
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setUserLike(:uuid,:authorUuid)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        authorUuid: req.body.authorUuid
                    }
                }).then(like => {
                    return reply.send({ result: 1, code: 'get-ok', like: like });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setShownAcceptation', { schema: schemas.setShownAcceptation, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid','isAdmin'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setShownAcceptation(:authorUuid,:contributionId,:candidateId)',
                {
                    replacements: {
                        authorUuid: req.body.authorUuid,
                        contributionId: req.body.contributionId,
                        candidateId: req.body.candidateId,
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'get-ok', done: done });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/reportProblemUser', { schema: schemas.reportProblemUser, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid', 'isAdmin'],
                where: {
                    banned: false
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL reportProblemUser(:uuid,:reportedUuid,:reason,:contributionId)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        reportedUuid: req.body.reportedUuid,
                        reason: req.body.reason,
                        contributionId: (req.body.contributionId) ? req.body.contributionId: null
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'get-ok', done: done });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setInterest', { schema: schemas.setInterest, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid', 'isAdmin'],
                where: {
                    banned: false
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setInterest(:uuid,:author_uuid,:contributionId,:interestDatetime,:price,:deleteId,:streetAcp,:postCode,:city,:gpsLocation,:accepted,:reserved,:platform)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        author_uuid: req.body.author_uuid,
                        contributionId: req.body.contributionId,
                        interestDatetime: req.body.interestDatetime,
                        price: (req.body.price) ? req.body.price : null,
                        deleteId: (req.body.deleteId) ? req.body.deleteId : null,
                        streetAcp: (req.body.streetAcp) ? req.body.streetAcp : null,
                        postCode: (req.body.postCode) ? req.body.postCode : null,
                        city: (req.body.city) ? req.body.city : null,
                        gpsLocation: (req.body.gpsLocation) ? req.body.gpsLocation : null,
                        accepted: (req.body.accepted) ? req.body.accepted : false,
                        reserved: (req.body.reserved) ? req.body.reserved : false,
                        platform: (req.body.platform) ? req.body.platform : null
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'get-ok', done: done[0].done, candidateId: done[0].candidateId, uuid: done[0].uuid });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setComment', { schema: schemas.setComment, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid', 'isAdmin'],
                where: {
                    banned: false
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setComment(:uuid,:id,:comment,:candidateId)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        id: req.body.id,
                        comment: req.body.comment,
                        candidateId: req.body.candidateId
                    }
                }).then(comment => {
                    return reply.send({ result: 1, code: 'get-ok', comment: comment });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setFilter', { schema: schemas.setFilter, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid','isAdmin'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setFilter(:uuid,:filterGroupId,:filterValue,:filterType)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        filterGroupId: (req.body.filterGroupId) ? req.body.filterGroupId : null,
                        filterValue: (req.body.filterValue) ? req.body.filterValue : null,
                        filterType: req.body.filterType
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'get-ok', done: done[0].done, filterGroupId: done[0].filterGroupId });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getUserProfile', { schema: schemas.getUserProfile, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin','uuid'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
        return sequelize.query('CALL getUserProfile(:uuid,:myUuid)',
            {
                replacements: {
                    uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                    myUuid: null
                }
            }).then(users => {
            return reply.send({ result: 1, code: 'get-ok', users: users });
        });
    }).catch(err => {
        console.log(err);
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/updateUserProfile', { schema: schemas.updateUserProfile, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
          model: db.Users,
          attributes: ['uuid', 'isAdmin'],
          required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      var update = {};
      //if ('email' in req.body) {
      //  update['email'] = req.body.email;
      //} else if ('password' in req.body) {
      //  update['password'] = req.body.password;
      //}
      if ('name' in req.body) {update['name'] = req.body.name;}
      if ('surName' in req.body) { update['surName'] = req.body.surName;}
      if ('city' in req.body) {update['city'] = req.body.city;}
      if ('postCode' in req.body) {update['postCode'] = req.body.postCode;}
      if ('streetAcp' in req.body) { update['streetAcp'] = req.body.streetAcp;}
      //if ('telephone' in req.body) { update['telephone'] = req.body.telephone;}
      if ('company' in req.body) { update['company'] = req.body.company;}
      if ('dic' in req.body) {update['dic'] = req.body.dic;}
      if ('ico' in req.body) { update['ico'] = req.body.ico; }
      if ('note' in req.body) { update['note'] = req.body.note; }
      if ('birthDate' in req.body) { update['birthDate'] = req.body.birthDate; }
      if ('memoNote' in req.body) { update['memoNote'] = req.body.memoNote; }
      if ('sex' in req.body) { update['sex'] = req.body.sex; }
      if ('privateAddress' in req.body) { update['privateAddress'] = req.body.privateAddress }
      if ('gpsLocation' in req.body) { update['gpsLocation'] = req.body.gpsLocation }
        if ('skype' in req.body) { update['skype'] = req.body.skype }
        if ('skypeDirect' in req.body) { update['skypeDirect'] = req.body.skypeDirect }
        if ('viber' in req.body) { update['viber'] = req.body.viber }
        if ('viberDirect' in req.body) { update['viberDirect'] = req.body.viberDirect }
        if ('facebook' in req.body) { update['facebook'] = req.body.facebook }
        if ('facebookDirect' in req.body) { update['facebookDirect'] = req.body.facebookDirect }
        if ('hangouts' in req.body) { update['hangouts'] = req.body.hangouts }
        if ('hangoutsDirect' in req.body) { update['hangoutsDirect'] = req.body.hangoutsDirect }
        if ('whatsApp' in req.body) { update['whatsApp'] = req.body.whatsApp }
        if ('whatsAppDirect' in req.body) { update['whatsAppDirect'] = req.body.whatsAppDirect }
        if ('emailDirect' in req.body) { update['emailDirect'] = req.body.emailDirect }
        if ('phoneDirect' in req.body) { update['phoneDirect'] = req.body.phoneDirect }
        if ('link' in req.body) { update['link'] = req.body.link }
        if ('linkDirect' in req.body) { update['linkDirect'] = req.body.linkDirect }
        if ('onlineAddress' in req.body) { update['onlineAddress'] = req.body.onlineAddress }
        if ('onlineAddressDirect' in req.body) { update['onlineAddressDirect'] = req.body.onlineAddressDirect }
        if ('profileRecommended' in req.body) { update['profileRecommended'] = req.body.profileRecommended }

      if (Object.keys(update).length > 0) {
        return db.Users.update(update, {
          where: {
              uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
          },
          individualHooks: true
        }).then(profile => {
          if ('email' in req.body) {
            //send email
          } else if ('password' in req.body) {
            //send email
          }
          return reply.send(msg.update);
        });
      }
      return reply.send(msg.update);
    }).catch(err => {
        console.log(err);
      return reply.send('email' in err.fields ? msg.signup.email : msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/setAcceptation', { schema: schemas.setAcceptation, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid', 'isAdmin'],
                where: {
                    banned: false
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setAcceptation(:uuid,:contributionId,:candidateId,:accepted,:rejected,:pending,:price,:changed,:acceptationDatetime,:streetAcp,:postCode,:city,:gpsLocation,:moveCanceled,:fieldsChanged,:reserved,:platform)',
                {
                replacements: {
                    uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                    contributionId: req.body.contributionId,
                    candidateId: req.body.candidateId,
                    accepted: (req.body.accepted) ? req.body.accepted : 0,
                    rejected: (req.body.rejected) ? req.body.rejected : 0,
                    pending: (req.body.pending) ? req.body.pending : 0,
                    price: (req.body.price) ? req.body.price : null,
                    changed: (req.body.changed) ? req.body.changed : 0,
                    acceptationDatetime: (req.body.acceptationDatetime) ? req.body.acceptationDatetime : null,
                    streetAcp: (req.body.streetAcp) ? req.body.streetAcp : null,
                    postCode: (req.body.postCode) ? req.body.postCode : null,
                    city: (req.body.city) ? req.body.city : null,
                    gpsLocation: (req.body.gpsLocation) ? req.body.gpsLocation : null,
                    moveCanceled: (req.body.moveCanceled) ? req.body.moveCanceled : null,
                    fieldsChanged: (req.body.fieldsChanged) ? req.body.fieldsChanged : null,
                    reserved: (req.body.reserved) ? req.body.reserved : 0,
                    platform: (req.body.platform) ? req.body.platform : null
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'get-ok', done: done });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getAcceptations', { schema: schemas.getAcceptations, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL getAcceptations(:contributionId)',
                {
                    replacements: {
                        contributionId: req.body.contributionId
                    }
                }).then(acceptations => {
                    return reply.send({ result: 1, code: 'get-ok', acceptations: acceptations });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getContribById', { schema: schemas.getContribById, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return db.Contributions.findAll({
                where: {
                    id: req.body.contributionId,
                    deleted: false
                },
                raw: true,
                attributes: [
                    'uuid', 'title', 'type', 'content', 'capacityFrom', 'capacityTo', 'price', 'currency', 'actionDatetime', 'gpsLocation', 'created', 'actionDatetime', 'streetAcp', 'postCode', 'city', 'priceFree', 'priceOwner', 'isPublished', 'insertPaymentRequired', 'insertPaymentPrice', 'videoUrl', 'distance','privateAddress','platform'
                ]
            }).then(contribution => {
                if (contribution[0].uuid != sessions.dataValues.user.uuid && contribution[0].privateAddress) {
                    contribution[0].gpsLocation = 0;
                    contribution[0].streetAcp = 0;
                }
                return reply.send({ result: 1, contribution: contribution });
            });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getFilters', { schema: schemas.getFilters, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return db.UserFilters.findAll({
                where: {
                    uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
                },
                raw: true,
                attributes: [
                    'filter_group_id','filter_value'
                ]
            }).then(filters => {
                return reply.send({ result: 1, filters: filters });
            });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setHideInterest', { schema: schemas.setHideInterest, attachValidation: true }, (req, reply) => {
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        if (req.validationError) {
            var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
            var code = error === msg.auth ? 200 : 400;
            return reply.code(code).send(error);
        }
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['uuid','isAdmin'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setHideInterest(:uuid,:contributionId,:candidateId,:hideForAuthor,:hideForCandidate)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        contributionId: req.body.contributionId,
                        candidateId: req.body.candidateId,
                        hideForAuthor: (req.body.hideForAuthor) ? req.body.hideForAuthor : false,
                        hideForCandidate: (req.body.hideForCandidate) ? req.body.hideForCandidate : false
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'get-ok', done: done });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getUser', { schema: schemas.getUser, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('uuid' in req.body) {
        return sequelize.query('CALL getUserProfile(:uuid,:myUuid)',
            {
                replacements: {
                    uuid: req.body.uuid,
                    myUuid: (req.body.myUuid) ? req.body.myUuid : null
                }
            }).then(users => {
                if (users[0].privateAddress) {
                    users[0].streetAcp = '';
                    users[0].gpsLocation = '';
                }
                return reply.send({ result: 1, code: 'get-ok', users: users });
            });
    }
    return reply.send(msg.auth);
});
server.post('/getFavoriteUsers', { schema: schemas.getFavoriteUsers, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            if ('uuid' in req.body) {
                return sequelize.query('CALL getFavoriteUsers(:uuid)',
                    {
                        replacements: {
                            uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
                        }
                    }).then(favorites => {
              
                        return reply.send({ result: 1, code: 'get-ok', favorites: favorites });
                    });
            }
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});


// for admin
server.post('/setAdvertisement', { schema: schemas.setAdvertisement, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setAdvertisement(:name,:mimeType,:content,:sequence,:recId,:link)',
                {
                    replacements: {
                        name: req.body.name,
                        mimeType: req.body.mimeType,
                        content: req.body.content,
                        link: req.body.link,
                        sequence: (req.body.sequence) ? req.body.sequence : 0,
                        recId: (req.body.recId) ? req.body.recId : null
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'set-ok', done: done });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setAppSettings', { schema: schemas.setAppSettings, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setAppSettings(:paramName,:value,:recId)',
                {
                    replacements: {
                        paramName: req.body.paramName,
                        value: req.body.value,
                        recId: (req.body.recId) ? req.body.recId : null
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'set-ok', done: done });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/updateUser', { schema: schemas.updateUser, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                required: true,
                attributes: ['uuid']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            var update = {};
            if ('email' in req.body) { update['email'] = req.body.email; }
            if ('name' in req.body) { update['name'] = req.body.name; }
            if ('surName' in req.body) { update['surName'] = req.body.surName; }
            if ('city' in req.body) { update['city'] = req.body.city; }
            if ('postCode' in req.body) { update['postCode'] = req.body.postCode; }
            if ('streetAcp' in req.body) { update['streetAcp'] = req.body.streetAcp; }
            if ('telephone' in req.body) { update['telephone'] = req.body.telephone; }
            if ('company' in req.body) { update['company'] = req.body.company; }
            if ('dic' in req.body) { update['dic'] = req.body.dic; }
            if ('ico' in req.body) { update['ico'] = req.body.ico; }
            if ('regComplete' in req.body) { update['regComplete'] = req.body.regComplete; }
            if ('regEmail' in req.body) { update['regEmail'] = req.body.regEmail; }
            if ('invoicePeriod' in req.body) { update['invoicePeriod'] = req.body.invoicePeriod; }
            if ('nextPayDate' in req.body) { update['nextPayDate'] = req.body.nextPayDate; }
            if ('nextPayDate_ts' in req.body) { update['nextPayDate_ts'] = req.body.nextPayDate_ts; }
            if ('creditNextPayDate' in req.body) { update['creditNextPayDate'] = req.body.creditNextPayDate; }
            if ('creditNextPayDate_ts' in req.body) { update['creditNextPayDate_ts'] = req.body.creditNextPayDate_ts; }
            if ('paymentVersion' in req.body) { update['paymentVersion'] = req.body.paymentVersion; }
            if ('price' in req.body) { update['price'] = req.body.price; }
            if ('registerDate' in req.body) { update['registerDate'] = req.body.registerDate; }
            if ('trial' in req.body) { update['trial'] = req.body.trial; }
            if ('deadtimeExpiration' in req.body) { update['deadtimeExpiration'] = req.body.deadtimeExpiration; }
            if ('groupId' in req.body) { update['groupId'] = req.body.groupId; }
            if ('isAdmin' in req.body) { update['isAdmin'] = req.body.isAdmin; }

            if (Object.keys(update).length > 0) {
                return db.Users.update(update, {
                    where: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
                    }
                }).then(user => {
                    if ('email' in req.body) {
                        //send email
                    }
                    return reply.send(msg.update);
                });
            }
            return reply.send(msg.update);
        }).catch(err => {
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getProblemReport', { schema: schemas.getProblemReport, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL getProblemReport(:reportedUuid)',
                {
                    replacements: {
                        reportedUuid: req.body.reportedUuid
                    }
                }).then(reports => {
                    return reply.send({ result: 1, code: 'set-ok', reports: reports });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setShownReport', { schema: schemas.setShownReport, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setShownReport(:id)',
                {
                    replacements: {
                        id: req.body.id
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'set-ok', done: done });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/setBan', { schema: schemas.setBan, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL setBan(:uuid,:contributionId,:isBanned)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid,
                        contributionId: (req.body.contributionId) ? req.body.contributionId : null,
                        isBanned: req.body.isBanned
                    }
                }).then(done => {
                    return reply.send({ result: 1, code: 'set-ok', done: done });
                }).catch(err => {
                    console.log(err);
                    return reply.send(msg.db);
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/removeUser', { schema: schemas.delete, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }

            if (req.body.what === 'user') {
                return db.Users.destroy({
                    where: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : null
                    },
                }).then(rows => {
                    if (rows < 1) {
                        return reply.send(msg.db);
                    }
                    return reply.send(msg.delete);
                }).catch(err => {
                    return reply.send(msg.db);
                });
            }
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }

    return reply.send(msg.auth);
});
server.post('/getUsers', { schema: schemas.getUsers, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
      return db.Sessions.findOne({
          where: {
              session: req.body.session,
              ip: req.raw.connection.remoteAddress
          },
          attributes: ['session', 'ip'],
          include: [{
              model: db.Users,
              where: {
                  isAdmin: true
              },
              required: true,
              attributes: ['uuid']
          }]
      }).then(sessions => {
          if (!sessions) {
              return reply.send(msg.privileges);
          }
          return db.Users.findAll({
              where: {
                  uuid: {
                      [Op.ne]: sessions.dataValues.user.uuid
                  },
                  [Op.or]: [
                      { regEmail: { [Op.like]: (req.body.filter) ? '%' + req.body.filter + '%' : 'nodata' } },
                      { name: { [Op.like]: (req.body.filter) ? '%' + req.body.filter + '%' : 'nodata' } },
                      { surName: { [Op.like]: (req.body.filter) ? '%' + req.body.filter + '%' : 'nodata' } },
                      { uuid: { [Op.like]: (req.body.filter) ? '%' + req.body.filter + '%' : 'nodata' } },
                      { uuid: { [Op.like]: (req.body.filter == 'allData') ? '%%' : 'nodata' } }
                  ]
              },
              order: [
                  ['registerDate', 'DESC']
              ],
              raw: true,
              attributes: [
                  'uuid', 'email', 'isSmsVerified', 'isEmailVerified', 'isAdmin', 'name', 'surName', 'city', 'streetAcp', 'postCode', 'telephone', 'regEmail', 'registerDate', 'groupId', 'type',
                  'isGdprConfirmed', 'note', 'birthDate', 'sex', 'memoNote', 'privateAddress', 'gpsLocation', 'skype', 'skypeDirect',
                  'viber', 'viberDirect', 'facebook', 'facebookDirect', 'hangouts', 'hangoutsDirect', 'whatsApp', 'whatsAppDirect', 'emailDirect', 'phoneDirect',
                  'link', 'linkDirect', 'onlineAddress', 'onlineAddressDirect', 'isViberVerified', 'isWhatsAppVerified', 'profileRecommended', 'passwordResetRequired', 'banned',
                  [Sequelize.fn("COUNT", Sequelize.col("problem_report.id")), "reportExist"],
                  [Sequelize.fn("COUNT", Sequelize.col("contributions.id")), "contibutionsBannedCount"],
                  [Sequelize.literal('IFNULL((SELECT MAX(`chat`.`candidateId`) FROM `chat` WHERE (`users`.`uuid` = `chat`.`forUuid` OR `users`.`uuid` = `chat`.`fromUuid`) AND `chat`.`contributionId` = 0),0)'), 'chatWithAdmin'],
                  [Sequelize.literal('IFNULL((SELECT COUNT(`c`.`id`) FROM `contribution` c WHERE `users`.`uuid` = `c`.`uuid`),0)'), 'contributionCount'],
                  [Sequelize.literal('IFNULL((SELECT COUNT(`pr`.`id`) FROM `problem_report` pr WHERE `pr`.`reportedUuid` = `users`.`uuid` AND `pr`.`shown` = FALSE),0)'), 'reportNotShownCount']
              ],
              include: [{
                  model: db.ProblemReport,
                  attributes: [],
                  required: false
              },{
                  model: db.Contributions,
                  where: {
                      banned: true
                  },
                  required: false,
                  attributes: []
              }],
              group: ['uuid']
          }).then(users => {
              return reply.send({ result: 1, users: users });
          });
      }).catch(err => {
          console.log(err);
      
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});




//global deletion
server.post('/delete', { schema: schemas.delete, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        //where: {
        //  isAdmin: true
        //},
        required: true,
        attributes: ['uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      if (req.body.what === 'contribution') {
          return db.Contributions.destroy({
              where: {
                  uuid: req.body.uuid,
                  id: req.body.id
            }
          }).then(rows => {
              if (rows < 1) {
                  return reply.send(msg.db);
              }
              return reply.send(msg.delete);
          }).catch(err => {
              return reply.send(msg.db);
          });
  
        } else if (req.body.what === 'attachment') {
            return db.Attachments.destroy({
                where: {
                    id: req.body.id
                }
            }).then(rows => {
                if (rows < 1) {
                    return reply.send(msg.db);
                }
                return reply.send(msg.delete);
            }).catch(err => {
                return reply.send(msg.db);
            });

        } else if (req.body.what === 'account') {
        return db.Users.destroy({
          where: {
            uuid: req.body.uuid
          }
        }).then(rows => {
          if (rows < 1) {
            return reply.send(msg.db);
          }
          return reply.send(msg.delete);
        });
      }
      return reply.send(msg.delete);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});


//payGatewayListener
server.post('/webhooks', { schema: schemas.webhooks, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        console.log("error payGateway income",req.body);
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    console.log("correct payGateway income", req.body);
    return reply.send({ result: 1, message: "ok" });
});


server.listen(cfg.server.port, cfg.server.address, err => {
  if (err) throw err;
  console.log('Server listenting on ' + cfg.server.address + ':' + cfg.server.port);
});
