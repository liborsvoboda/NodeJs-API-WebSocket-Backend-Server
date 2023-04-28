const fs = require('fs');
const path = require('path');
const uWS = require('uWebSockets.js');
const Sequelize = require('sequelize');
const fastify = require('fastify');
const IndexHints = Sequelize.IndexHints;
const moment = require('moment');
const Ajv = require('ajv');
const fastJson = require('fast-json-stringify');
const decoder = new TextDecoder();
const db = require('./api_models/ws_db');


const cfg = JSON.parse(fs.readFileSync(path.join('./config/ws_config.json'), 'utf8'));
const schemas = JSON.parse(fs.readFileSync(path.join('./api_schemas/ws_schemas.json'), 'utf8'));
const messages = JSON.parse(fs.readFileSync(path.join('./api_messages/ws_messages.json'), 'utf8'));

const updateSchema = fastJson(schemas.default);
const ajv = new Ajv({ removeAdditional: true });

const setChatRequest = ajv.compile(schemas.setChat.request);
const setShownChatRequest = ajv.compile(schemas.setShownChat.request);
const removeChatRequest = ajv.compile(schemas.removeChat.request);
const removeGroupChatRequest = ajv.compile(schemas.removeGroupChat.request);
const getChatRequest = ajv.compile(schemas.getChat.request);
const allChatRequest = ajv.compile(schemas.getAllChat.request);
const getChatCountRequest = ajv.compile(schemas.getChatCount.request);
const getChatGroupsRequest = ajv.compile(schemas.getChatGroups.request);
const getChatContribsRequest = ajv.compile(schemas.getChatContribs.request);
const getChatInterestsRequest = ajv.compile(schemas.getChatInterests.request);



const getNotificationsGroupsRequest = ajv.compile(schemas.getNotificationsGroups.request);

const setShownRequest = ajv.compile(schemas.setShown.request);
const removeNotificationRequest = ajv.compile(schemas.removeNotification.request);
const NotificationsCountRequest = ajv.compile(schemas.getNotificationsCount.request);
const NotificationsRequest = ajv.compile(schemas.getNotifications.request);
const AllNotificationsRequest = ajv.compile(schemas.getAllNotifications.request);

const NotificationsCountResponse = fastJson(schemas.getNotificationsCount.response);
const getNotificationsGroupsResponse = fastJson(schemas.getNotificationsGroups.response);
const NotificationsResponse = fastJson(schemas.getAllNotifications.response);
const removeGroupChatResponse = fastJson(schemas.removeGroupChat.response);
const getChatCountResponse = fastJson(schemas.getChatCount.response);
const getChatGroupsResponse = fastJson(schemas.getChatGroups.response);
const getChatContribsResponse = fastJson(schemas.getChatContribs.response);
const getChatInterestsResponse = fastJson(schemas.getChatInterests.response);

const chatResponse = fastJson(schemas.getAllChat.response);

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
    keepDefaultTimezone: true,
    dialectOptions: {
//        useUTC: false, 
        dateStrings: true,
        typeCast: true
    },
});

uWS.SSLApp({
    key_file_name: path.join(__dirname, cfg.ssl_key),
    cert_file_name: path.join(__dirname, cfg.ssl_cert)
}).ws('/*', {
    /* Options */
    compression: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 121,
    /* Handlers */
    open: (ws, req) => {
        //
    },
    message: (ws, message, isBinary) => {
        /* Ok is false if backpressure was built up, wait for drain */
        //var ok = ws.send(message, isBinary);
        if (!isBinary) {
            try {
                var msg = JSON.parse(decoder.decode(message));
            } catch (e) {
                return ws.send(updateSchema(messages.request.error));
            }
            if (typeof msg === 'object' && 'method' in msg && 'data' in msg) {
                if (msg.method === 'getNotifications') {
                    if (!NotificationsRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getNotifications(:uuid,:created,:fromUuid)',
                        {
                            replacements: {
                                uuid: sessions.user.dataValues.isAdmin && 'uuid' in msg.data && msg.data.uuid.length === 36 ? msg.data.uuid : sessions.user.dataValues.uuid,
                                created: msg.data.created,
                                fromUuid: msg.data.fromUuid
                            }
                        }).then(notifications => {
                            return ws.send(NotificationsResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: notifications }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                            });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });
                } else if (msg.method === 'getNotificationsGroups') {
                    if (!getNotificationsGroupsRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getNotificationsGroups(:uuid)',
                        {
                            replacements: {
                                uuid: sessions.user.dataValues.isAdmin && 'uuid' in msg.data && msg.data.uuid.length === 36 ? msg.data.uuid : sessions.user.dataValues.uuid
                            }
                        }).then(notificationsGroups => {
                            return ws.send(getNotificationsGroupsResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: notificationsGroups }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                            });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });					
                } else if (msg.method === 'getAllNotifications') {
                    if (!AllNotificationsRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getAllNotifications(:uuid,:countNo,:pageNo,:fromUuid)',
                        {
                            replacements: {
                                uuid: sessions.user.dataValues.isAdmin && 'uuid' in msg.data && msg.data.uuid.length === 36 ? msg.data.uuid : sessions.user.dataValues.uuid,
                                countNo: msg.data.countNo,
                                pageNo: msg.data.pageNo,
                                fromUuid: msg.data.fromUuid
                            }
                        }).then(notifications => {
                            return ws.send(NotificationsResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: notifications }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                            });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'setShown') {
                    if (!setShownRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL setShown(:uuid,:created,:fromUuid)',
                        {
                            replacements: {
                                uuid: sessions.user.dataValues.isAdmin && 'uuid' in msg.data && msg.data.uuid.length === 36 ? msg.data.uuid : sessions.user.dataValues.uuid,
                                created: msg.data.created,
                                fromUuid: msg.data.fromUuid
                            }
                        }).then(notifications => {
                            return ws.send(NotificationsResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: notifications }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                            });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'removeNotification') {
                    if (!removeNotificationRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL removeNotification(:uuid,:id,:created,:fromUuid)',
                        {
                            replacements: {
                                uuid: sessions.user.dataValues.isAdmin && 'uuid' in msg.data && msg.data.uuid.length === 36 ? msg.data.uuid : sessions.user.dataValues.uuid,
                                id: msg.data.id,
                                created: msg.data.created,
                                fromUuid: msg.data.fromUuid
                            }
                        }).then(notifications => {
                            return ws.send(NotificationsResponse({ recId: msg.data.id, reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: notifications }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                            });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'getNotificationsCount') {
                    if (!NotificationsCountRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getNotificationsCount(:uuid)',
                            {
                                replacements: {
                                    uuid: sessions.user.dataValues.isAdmin && 'uuid' in msg.data && msg.data.uuid.length === 36 ? msg.data.uuid : sessions.user.dataValues.uuid
                                }
                            }).then(notificationsCount => {
                                return ws.send(NotificationsCountResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: notificationsCount }));
                            }).catch(err => {
                                var r = messages.get.error;
                                r['req'] = msg.req;
                                return ws.send(updateSchema(r));
                            });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });
                 
                } else if (msg.method === 'getChatGroups') {
                    if (!getChatGroupsRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getChatGroups(:forUuid)',
                        {
                            replacements: {
                                forUuid: sessions.user.dataValues.isAdmin && 'forUuid' in msg.data && msg.data.forUuid.length === 36 ? msg.data.forUuid : sessions.user.dataValues.uuid 
                            }
                        }).then(chatGroups => {
                            return ws.send(getChatGroupsResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: chatGroups }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'getChatContribs') {
                    if (!getChatContribsRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getChatContribs(:forUuid,:fromUuid)',
                        {
                            replacements: {
                                forUuid: sessions.user.dataValues.isAdmin && 'forUuid' in msg.data && msg.data.forUuid.length === 36 ? msg.data.forUuid : sessions.user.dataValues.uuid,
                                fromUuid: msg.data.fromUuid
                            }
                        }).then(chatContribs => {
                            return ws.send(getChatContribsResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: chatContribs }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'getChatInterests') {
                    if (!getChatInterestsRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getChatInterests(:forUuid,:fromUuid,:contributionId)',
                        {
                            replacements: {
                                forUuid: sessions.user.dataValues.isAdmin && 'forUuid' in msg.data && msg.data.forUuid.length === 36 ? msg.data.forUuid : sessions.user.dataValues.uuid,
                                fromUuid: msg.data.fromUuid,
                                contributionId: msg.data.contributionId
                            }
                        }).then(chatInterests => {
                            return ws.send(getChatInterestsResponse({ reqName: msg.method, reqContrib: msg.data.contributionId, req: msg.req, result: 1, code: 'get-ok', message: chatInterests }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'getAllChat') {
                    if (!allChatRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getAllChat(:forUuid,:contributionId,:candidateId,:countNo,:pageNo)',
                        {
                            replacements: {
                                forUuid: sessions.user.dataValues.isAdmin && 'forUuid' in msg.data && msg.data.forUuid.length === 36 ? msg.data.forUuid : sessions.user.dataValues.uuid,
                                countNo: msg.data.countNo,
                                pageNo: msg.data.pageNo,
                                contributionId: msg.data.contributionId,
                                candidateId: msg.data.candidateId
                            }
                        }).then(chat => {
                            return ws.send(chatResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: chat }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });		
                } else if (msg.method === 'setChat') {
                    if (!setChatRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL setChat(:fromUuid,:forUuid,:content,:contributionId,:candidateId,:created)',
                        {
                            replacements: {
                                fromUuid: sessions.user.dataValues.isAdmin && 'fromUuid' in msg.data && msg.data.fromUuid.length === 36 ? msg.data.fromUuid : sessions.user.dataValues.uuid,
                                forUuid: msg.data.forUuid,
                                content: msg.data.content,
                                contributionId:  msg.data.contributionId,
                                candidateId: (msg.data.candidateId) ? msg.data.candidateId : null,
                                created: msg.data.created
                            }
                        }).then(chat => {
                            return ws.send(chatResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: chat }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'getChat') {
                    if (!getChatRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getChat(:forUuid,:candidateId,:created)',
                        {
                            replacements: {
                                forUuid: sessions.user.dataValues.isAdmin && 'forUuid' in msg.data && msg.data.forUuid.length === 36 ? msg.data.forUuid : sessions.user.dataValues.uuid,
                                candidateId: msg.data.candidateId,
                                created: msg.data.created
                            }
                        }).then(chat => {
                            return ws.send(chatResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: chat }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'getChatCount') {
                    if (!getChatCountRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL getChatCount(:forUuid)',
                        {
                            replacements: {
                                forUuid: sessions.user.dataValues.isAdmin && 'forUuid' in msg.data && msg.data.forUuid.length === 36 ? msg.data.forUuid : sessions.user.dataValues.uuid 
                            }
                        }).then(chat => {
                            return ws.send(getChatCountResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: chat }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });			
                } else if (msg.method === 'removeGroupChat') {
                    if (!removeGroupChatRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL removeGroupChat(:fromUuid,:forUuid,:deleteContributionId,:deleteCandidateId)',
                        {
                            replacements: {
                                fromUuid: sessions.user.dataValues.isAdmin && 'fromUuid' in msg.data && msg.data.fromUuid.length === 36 ? msg.data.fromUuid : sessions.user.dataValues.uuid,
                                forUuid: msg.data.forUuid,
                                deleteContributionId: (msg.data.deleteContributionId) ? msg.data.deleteContributionId : null,
                                deleteCandidateId: (msg.data.deleteCandidateId) ? msg.data.deleteCandidateId : null
                            }
                        }).then(removed => {
                            return ws.send(removeGroupChatResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', removed: removed[0].removed }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                } else if (msg.method === 'removeChat') {
                    if (!removeChatRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL removeChat(:fromUuid,:id,:candidateId,:created)',
                        {
                            replacements: {
                                fromUuid: sessions.user.dataValues.isAdmin && 'fromUuid' in msg.data && msg.data.fromUuid.length === 36 ? msg.data.fromUuid : sessions.user.dataValues.uuid,
                                id: msg.data.id,
                                candidateId: msg.data.candidateId,
                                created: msg.data.created
                            }
                        }).then(chat => {
                            return ws.send(chatResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: chat }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });		
                } else if (msg.method === 'setShownChat') {
                    if (!setShownChatRequest(msg.data)) {
                        var r = messages.request.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    }
                    return db.Sessions.findOne({
                        where: {
                            session: msg.data.session
                        },
                        attributes: ['session', 'ip'],
                        include: [{
                            model: db.Users,
                            attributes: ['isAdmin', 'uuid'],
                            required: true
                        }]
                    }).then(sessions => {
                        if (!sessions) {
                            var r = messages.privileges.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        }
                        return sequelize.query('CALL setShownChat(:forUuid,:candidateId,:created)',
                        {
                            replacements: {
                                forUuid: sessions.user.dataValues.isAdmin && 'forUuid' in msg.data && msg.data.forUuid.length === 36 ? msg.data.forUuid : sessions.user.dataValues.uuid,
                                candidateId: msg.data.candidateId,
                                created: msg.data.created
                            }
                        }).then(chat => {
                            return ws.send(chatResponse({ reqName: msg.method, req: msg.req, result: 1, code: 'get-ok', message: chat }));
                        }).catch(err => {
                            var r = messages.get.error;
                            r['req'] = msg.req;
                            return ws.send(updateSchema(r));
                        });
                    }).catch(err => {
                        var r = messages.get.error;
                        r['req'] = msg.req;
                        return ws.send(updateSchema(r));
                    });	
                }
            } else {
            var r = messages.request.error;
                r['req'] = msg.req;
            return ws.send(updateSchema(r));
            }
        }
    },
    drain: (ws) => {
        console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
    },
    close: (ws, code, message) => {
        console.log('WebSocket closed');
    }
}).any('/*', (res, req) => {
    // Load balancing
    res.writeHeader('content-type', 'application/json; charset=utf-8').writeHeader('Access-Control-Allow-Origin', '*').end(JSON.stringify({ ws: 'wss://' + cfg.address + ':' + cfg.port + '/' }));
}).listen(cfg.port, (token) => {
    if (token) {
        console.log('Listening to port ' + cfg.port);
    } else {
        console.log('Failed to listen to port ' + cfg.port);
    }
});
