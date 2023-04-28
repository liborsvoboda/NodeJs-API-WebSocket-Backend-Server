module.exports = (sequelize, type) => {
  return sequelize.define('users', {
    uuid: {
      type: type.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: type.UUIDV4
    },
    email: {
      type: type.STRING,
      unique: true,
      allowNull: false
    },
    password: {
      type: type.STRING,
      allowNull: false
    },
    isSmsVerified: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isEmailVerified: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    isAdmin: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    confirmationSms: {
      type: type.STRING(32),
      allowNull: true
    },
    confirmationEmail: {
        type: type.STRING(32),
        allowNull: true
    },
    name: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    surName: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    city: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    streetAcp: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    postCode: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    telephone: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    company: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    dic: {
      type: type.STRING(20),
      allowNull: false,
      defaultValue: ''
    },
    ico: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    regComplete: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    regEmail: {
      type: type.STRING,
      allowNull: false
    },
    invoicePeriod: {
      type: type.STRING,
      allowNull: false,
      defaultValue: 'month'
    },
    nextPayDate: {
      type: type.DATEONLY,
      allowNull: false
    },
    nextPayDate_ts: {
      type: type.INTEGER(11),
      allowNull: false
    },
    paymentVersion: {
      type: type.STRING,
      allowNull: false,
      defaultValue: 'Trial'
    },
    price: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    registerDate: {
      type: type.DATEONLY,
      allowNull: false
    },
    trial: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    deadtimeExpiration: {
      type: type.INTEGER(11),
      allowNull: false
    },
    groupId: {
      type: type.INTEGER(11),
      allowNull: true
    },
    creditNextPayDate: {
      type: type.DATEONLY,
      allowNull: false
    },
    creditNextPayDate_ts: {
      type: type.INTEGER(11),
      allowNull: false
    },
    type: {
        type: type.STRING,
        allowNull: false,
        defaultValue: ''
    },
    isGdprConfirmed: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    note: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    birthDate: {
        type: type.DATEONLY,
        allowNull: true
    },
    sex: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    confirmEmailExpiry: {
        type: type.INTEGER(11),
        allowNull: true
    },
    confirmSmsExpiry: {
        type: type.INTEGER(11),
        allowNull: true
    },
    memoNote: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    privateAddress: {
        type: type.BOOLEAN,
        allowNull: true
    },
    gpsLocation: {
        type: type.STRING,
        allowNull: true
    },
    skype: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    skypeDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    viber: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    viberDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    facebook: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    facebookDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    hangouts: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    hangoutsDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    whatsApp: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    whatsAppDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    emailDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    phoneDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    link: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    linkDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    confirmEmailRequest: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    onlineAddress: {
        type: type.STRING,
        allowNull: true,
        defaultValue: ''
    },
    onlineAddressDirect: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    confirmViberRequest: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    confirmWhatsAppRequest: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    isViberVerified: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    isWhatsAppVerified: {
        type: type.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      profileRecommended: {
          type: type.BOOLEAN,
          allowNull: false,
          defaultValue: false
      },
      passwordResetRequired: {
          type: type.BOOLEAN,
          allowNull: false,
          defaultValue: false
      },
      banned: {
          type: type.STRING,
          allowNull: false,
          defaultValue: false
      },
  }, {
    indexes: [
      {
        unique: false,
        name: 'expiration',
        fields: ['deadtimeExpiration']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
