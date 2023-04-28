const fs = require('fs');
const path = require('path');
const db = require('../api_models/api_db');

const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8'));
const usersCols = ['email', 'password', 'isVerified', 'isAdmin', 'confirmationEmail', 'Name', 'Surname', 'City', 'StreetACP', 'Postcode', 'Telephone', 'Company', 'Dic', 'Ico', 'Level', 'StepProfileFinished', 'RegComplete', 'RegEmail', 'SmartRegComplete', 'SmartStamp', 'CreditCounts', 'CreditVariant', 'InvoicePeriod', 'NextPayDate', 'NextPayDate_ts', 'PaymentVersion', 'Price', 'RegisterDate', 'Trial', 'StepHelpFinished', 'heurekaAPIkey', 'StepHeurekaFinished', 'StepTeamFinished', 'a_box', 'a_cha', 'deadtimeExpiration', 'flags', 'cas', 'expiry'];
var usersMigrate = [];
for (var i = 0; i < users.length; i++) {
  var row = {};
  for (var x = 0; x < usersCols.length; x++) {
    row[usersCols[x]] = users[i][x];
  }
  usersMigrate.push(row);
}
db.Users.bulkCreate(usersMigrate, { individualHooks: true }).then(res => {
  console.log(res);
}).catch(err => {
  console.log(err);
});
