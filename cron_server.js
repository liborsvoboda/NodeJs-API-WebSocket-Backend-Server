const fs = require('fs');
const path = require('path');
const axios = require('axios');
const parser = require('fast-xml-parser');
const moment = require('moment');
const cron = require('node-cron');
const Sequelize = require('sequelize');
const ZongJi = require('zongji');
const db = require('./api_models/cron_db');
//const cronbackend = require('./cronbackend');
const Promise = require('bluebird');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const request = require('request');

const cfg = JSON.parse(fs.readFileSync(path.join('./config/api_config.json'), 'utf8'));
const zongji = new ZongJi(cfg.server.db.realtime);

const cronCfg = JSON.parse(fs.readFileSync(path.join('./config/cron_config.json'), 'utf8'));

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

var transporter = nodemailer.createTransport({
    host: cronCfg.smtp.host,
    port: cronCfg.smtp.port,
    secure: cronCfg.smtp.secure, // upgrade later with STARTTLS
    auth: {
        user: cronCfg.smtp.auth.user,
        pass: cronCfg.smtp.auth.pass
    },
    tls: {
        rejectUnauthorized: cronCfg.smtp.auth.rejectUnauthorized
    }
});

async function sendEmail(email, confirmationEmail) {
    let info = await transporter.sendMail({
        from: 'info@happytohelp.eu', // sender address
        to: email, // list of receivers
        subject: "Reset Hesla", // Subject line
        //text: "Hello world?", // plain text body
        html: "<b>Reset Hesla</b><div><a href='https://h2hdemo.firebaseapp.com/resetlink?email=" + email + "&confirmationEmail=" + confirmationEmail+"'>Pro reset hesla klikněte na tento odkaz. Odkaz je platný 15 minut</a></>" // html body
    });

    console.log("Email Message sent: %s", email, info.messageId);
}

function sendProblemEmail(uuid, reportedUuid, contributionId) {
    return sequelize.query('CALL getReportProblemUser(:uuid,:reportedUuid,:contributionId)',
        {
            replacements: {
                uuid: uuid,
                reportedUuid: reportedUuid,
                contributionId: contributionId
            }
        }).then(report => {
            let info = transporter.sendMail({
                from: 'report@happytohelp.eu', // sender address
                to: cronCfg.reportEmail, // list of receivers
                subject: "Nahlášení problémového uživatele od: " + report[0].authorName, // Subject line
                //text: "Hello world?", // plain text body
                html: "<b>Zpráva o problémovém uživateli: " + report[0].problemName + "</b><div>Příspěvek: " + report[0].title + "</div><div><b>Popis:</b> " + report[0].reason + "</div>" // html body
            });
        });
 
}

async function sendEmailVerify(email, confirmationEmail) {
    let info = await transporter.sendMail({
        from: 'info@happytohelp.eu', // sender address
        to: email, // list of receivers
        subject: "Overenie emailovej adresy", // Subject line
        //text: "Hello world?", // plain text body
        html: "<div><a href='https://h2hdemo.firebaseapp.com/emailVerify?email=" + email + "&confirmationEmail=" + confirmationEmail + "'>Pre overenie tvojho emailu v aplikácii HappyToHelp klikni na tento odkaz.</a></div><div>Odkaz je platný 15 minút.</div><br /><br /><div>Ďakujeme, že si s nami!</div><div>HappyToHelp tím</div>" // html body
    });

    console.log("Email Verify Message sent: %s", email, info.messageId);
}

async function sendSms(sms, confirmationSms) {
    return new Promise((resolve, reject) => {
        let checkCode = cronCfg.sms.sender + parseInt(sms) + "HappyToHelp! Overovací kód je: " + confirmationSms + " Kód je platný 5 minút.";
        let subject = crypto.createHmac('sha1', cronCfg.sms.IntegrationKey).update(checkCode).digest("hex");
    
        request.post(cronCfg.sms.apiUrl, {
            json: {
                iid: cronCfg.sms.IntegrationId,
                sndr: cronCfg.sms.sender,
                sgn: subject,
                rcpt: parseInt(sms),
                flgs: cronCfg.sms.flags,
                txt: "HappyToHelp! Overovací kód je: " + confirmationSms + " Kód je platný 5 minút."
            }
        }, (error, res, body) => {
            if (error) {
                console.log("SMS Message sent error: ", sms, parseInt(sms));
                reject(error);
            }

            if (body.err_code =="FAILED") {
                console.log("SMS Message sent error: ", sms, parseInt(sms), body);
                reject(body);
            } else {
                console.log("SMS Message sent: ", sms, parseInt(sms));
                resolve(body);
            }
        });
    });
}
async function sendViberSms(sms, confirmationSms) {
    return new Promise((resolve, reject) => {
        let checkCode = cronCfg.sms.sender + parseInt(sms) + "Vítejte v HappyToHelp. Váš Viber ověřovací kód platný 5 minut je:" + confirmationSms;
        let subject = crypto.createHmac('sha1', cronCfg.sms.IntegrationKey).update(checkCode).digest("hex");

        request.post(cronCfg.sms.apiUrl, {
            json: {
                iid: cronCfg.sms.IntegrationId,
                sndr: cronCfg.sms.sender,
                sgn: subject,
                rcpt: parseInt(sms),
                flgs: cronCfg.sms.flags,
                txt: "Vítejte v HappyToHelp. Váš Viber ověřovací kód platný 5 minut je:" + confirmationSms
            }
        }, (error, res, body) => {
            if (error) {
                console.log("SMS Viber Message sent error: ", sms, parseInt(sms));
                reject(error);
            }

            if (body.err_code == "FAILED") {
                console.log("SMS Viber Message sent error: ", sms, parseInt(sms), body);
                reject(body);
            } else {
                console.log("SMS Viber Message sent: ", sms, parseInt(sms));
                resolve(body);
            }
        });
    });
}
async function sendWhatsAppSms(sms, confirmationSms) {
    return new Promise((resolve, reject) => {
        let checkCode = cronCfg.sms.sender + parseInt(sms) + "Vítejte v HappyToHelp. Váš WhatsApp ověřovací kód platný 5 minut je:" + confirmationSms;
        let subject = crypto.createHmac('sha1', cronCfg.sms.IntegrationKey).update(checkCode).digest("hex");

        request.post(cronCfg.sms.apiUrl, {
            json: {
                iid: cronCfg.sms.IntegrationId,
                sndr: cronCfg.sms.sender,
                sgn: subject,
                rcpt: parseInt(sms),
                flgs: cronCfg.sms.flags,
                txt: "Vítejte v HappyToHelp. Váš WhatsApp ověřovací kód platný 5 minut je:" + confirmationSms
            }
        }, (error, res, body) => {
            if (error) {
                console.log("SMS WhatsApp Message sent error: ", sms, parseInt(sms));
                reject(error);
            }

            if (body.err_code == "FAILED") {
                console.log("SMS WhatsApp Message sent error: ", sms, parseInt(sms), body);
                reject(body);
            } else {
                console.log("SMS WhatsApp Message sent: ", sms, parseInt(sms));
                resolve(body);
            }
        });
    });
}


let tokenRequest = {
    method: 'POST',
    url: cronCfg.payGate.authorizeUrl,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        client_id: cronCfg.payGate.client_id,
        client_secret: cronCfg.payGate.client_secret
    })
};
let getPaymentsMethods = {
    method: 'GET',
    url: cronCfg.payGate.paymentMethodsUrl,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': null
    }
};
let payRequest = {
    method: 'POST',
    url: cronCfg.payGate.payUrl,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: {
        amount: 0,
        currency: "",
        customer: {
            email: "",
            first_name: "",
            last_name: ""
        },
        external_id: null,
        metadata: { "note": "description" },
        nonce: null,
        redirect_url: "https://h2hdemo.firebaseapp.com/",
        signature: null
    }

};


function getPayToken(contributionId, ownerUuid, price, currency) {
    return new Promise((resolve, reject) => {
        request(tokenRequest, function (error, response) {
            if (error) { throw new Error(error); reject(error); }
            let token = JSON.parse(response.body).token;

            return db.Users.findOne({
                where: {uuid: ownerUuid},
                raw: true,
                attributes: ['email', 'name', 'surName']
            }).then(users => {
                console.log(users, payRequest.body.customer.first_name);
                //set data
                payRequest.body.customer.first_name = users.name;
                payRequest.body.customer.last_name = users.surName;
                payRequest.body.customer.email = users.email;
                payRequest.headers.Authorization = 'Bearer ' + token;
                payRequest.body.amount = price;
                payRequest.body.currency = currency;
                payRequest.body.external_id = contributionId.toString() + '_' + ownerUuid;
                payRequest.body.redirect_url += payRequest.body.external_id;
                payRequest.body.nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                payRequest.body.signature = crypto.createHash('sha256').update( parseFloat(payRequest.body.amount) + "|" + payRequest.body.currency + "|" + payRequest.body.external_id + "|" + payRequest.body.nonce + "|" + cronCfg.payGate.client_secret).digest('hex'); 

               
                let myRequest = JSON.parse(JSON.stringify(payRequest));
                myRequest.body = JSON.stringify(payRequest.body);
                console.log("myRequest", myRequest);
                request(myRequest, function (error, response) {
                    if (error) { throw new Error(error); reject(error); }

                    console.log("platba", response.body,JSON.parse(response.body).checkout_url);
                    return db.ContributionPayments.update({
                        checkout_url: JSON.parse(response.body).checkout_url,
                        nonce: JSON.parse(response.body).nonce,
                        status: JSON.parse(response.body).status

                    }, {
                        where: {
                            owner_uuid: ownerUuid,
                            contribution_id: contributionId
                        }
                    }).then(payment => {
                        resolve(payment);
                    }).catch(err => {
                        console.log("update ERR",err);
                        reject(err);
                    });
                    
                });
            });
        });
    });
}
function getPaymentsMethod() {
    return new Promise((resolve, reject) => {
        request(tokenRequest, function (error, response) {
            if (error) { throw new Error(error); reject(error); }
            let token = JSON.parse(response.body).token;

            //set data
            payRequest.headers.Authorization = 'Bearer ' + token;
            request(getPaymentsMethods, function (error, response) {
                if (error) { throw new Error(error); reject(error); }
                console.log("platební metody", response.body);
                resolve(response);
            });
        });
    });
}



//tepmlate
function myPromise(ms, callback) {
    return new Promise(function(resolve, reject) {
        // Set up the real work
        callback(resolve, reject);

        // Set up the timeout
        setTimeout(function() {
            reject('Promise timed out after ' + ms + ' ms');
        }, ms);
    });
}
// example use
//timedPromise(2000, function(resolve, reject) {Real work is here});




function isEmail(e) {
  if (e) {
    var t = e.trim();
    return !(t.indexOf(' ') >= 0 || '' === e || !/^[^@]+@[^@.]+\.[^@]*\w\w$/.test(t) || e.match(/[\(\)\<\>\,\;\:\\\'\[\]]/));
  }
  return false;
}
function removeUnicodeChars(e) {
    if (e) {
        var t = e.trim();
        return t.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '');
    }
    return '';
}


function hasChanges(database, table, updates) {
    var promises = [];
    for (var i = 0; i < updates.length; i++) {
        if (table === 'users') {
            if (updates[i].changes.indexOf('confirmationEmail') > -1 && updates[i].row['confirmationEmail'] !== null && updates[i].row['confirmEmailRequest'] == false) {
                promises.push(sendEmail(removeUnicodeChars(updates[i].row['email']), removeUnicodeChars(updates[i].row['confirmationEmail'])));
            } else if (updates[i].changes.indexOf('confirmationEmail') > -1 && updates[i].row['confirmationEmail'] !== null && updates[i].row['confirmEmailRequest'] == true) {
                promises.push(sendEmailVerify(removeUnicodeChars(updates[i].row['email']), removeUnicodeChars(updates[i].row['confirmationEmail'])));
            } else if (updates[i].changes.indexOf('confirmationSms') > -1 && updates[i].row['confirmationSms'] !== null && removeUnicodeChars(updates[i].row['confirmationSms']).length == 6 && updates[i].row['confirmViberRequest'] == false && updates[i].row['confirmWhatsAppRequest'] == false) {
                promises.push(sendSms(removeUnicodeChars(updates[i].row['telephone']), removeUnicodeChars(updates[i].row['confirmationSms'])));
            } else if (updates[i].changes.indexOf('confirmationSms') > -1 && updates[i].row['confirmationSms'] !== null && removeUnicodeChars(updates[i].row['confirmationSms']).length == 6 && updates[i].row['confirmViberRequest'] == true && updates[i].row['confirmWhatsAppRequest'] == false) {
                promises.push(sendViberSms(removeUnicodeChars(updates[i].row['viber']), removeUnicodeChars(updates[i].row['confirmationSms'])));
            } else if (updates[i].changes.indexOf('confirmationSms') > -1 && updates[i].row['confirmationSms'] !== null && removeUnicodeChars(updates[i].row['confirmationSms']).length == 6 && updates[i].row['confirmViberRequest'] == false && updates[i].row['confirmWhatsAppRequest'] == true) {
                promises.push(sendWhatsAppSms(removeUnicodeChars(updates[i].row['whatsApp']), removeUnicodeChars(updates[i].row['confirmationSms'])));
            }
        }
    }
    Promise.all(promises).then(values => {
    //console.log(values);
    }).catch(err => {
    return console.log(err);
    });
}
function updatedRows(database, table, rows) {
    var updates = rows.map(function (row) {
        var changed = [];
        for (var val in row['before']) {
            if (row['before'][val] !== row['after'][val]) {
                changed.push(val);
            }
        }
    return { changes: changed, row: row['after'] };
    });
  hasChanges(database, table, updates);
}
function writtenRows(database, table, rows) {
  var promises = [];
  for (var i = 0; i < rows.length; i++) {
      if (table === 'contribution_payments') {
          promises.push(getPayToken(rows[i]['contribution_id'], removeUnicodeChars(rows[i]['owner_uuid']), rows[i]['price'], removeUnicodeChars(rows[i]['currency'])));
      } else if (table === 'problem_report') {
          promises.push(sendProblemEmail(removeUnicodeChars(rows[i]['uuid']), removeUnicodeChars(rows[i]['reportedUuid']), rows[i]['contribution_id'] ));
      } 
  }
  Promise.all(promises).then(values => {
    //console.log(values);
  }).catch(err => {
    return console.log(err);
  });
}



// Each change to the replication log results in an event
zongji.on('binlog', function(evt) {
    if (evt.getEventName() === 'updaterows') {
    return updatedRows(evt.tableMap[evt.tableId]['parentSchema'], evt.tableMap[evt.tableId]['tableName'], evt.rows);
  } else if (evt.getEventName() === 'writerows') {
    return writtenRows(evt.tableMap[evt.tableId]['parentSchema'], evt.tableMap[evt.tableId]['tableName'], evt.rows);
  }
});

// Binlog must be started, optionally pass in filters
zongji.start({
  serverId:cfg.server.db.realtime.serverId,
  startAtEnd: true,
  includeEvents: ['tablemap', 'writerows', 'updaterows'],
  excludeEvents: ['xid', 'format', 'rotate', 'intvar', 'query', 'unknown'],
  includeSchema: {
      'HappyToHelp': ['users','contribution_payments',"problem_report"]
  },
  excludeSchema: {
    'HappyToHelp': ['attachments', 'contribution', 'contribution_comments', 'contribution_likes', 'contribution_rating', 'contribution_type_list', 'currency_list', 'login_history', 'phone_codes', 'sessions', 'tag_list','tag_using']
  }
});

process.on('SIGINT', function() {
  console.log('Got SIGINT.');
  zongji.stop();
  process.exit();
});
