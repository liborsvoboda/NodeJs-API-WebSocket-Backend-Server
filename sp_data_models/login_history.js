module.exports = (sequelize, type) => {
  return sequelize.define('login_history', {
    id: {
      type: type.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    uuid: {
      type: type.UUID,
      allowNull: false
    },
    isLogin: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    ip: {
      type: type.STRING(15),
      allowNull: false
    },
    timestamp: {
      type: type.INTEGER(11),
      allowNull: false
    }
  }, {
    indexes: [
      {
        unique: false,
        name: 'UUID',
        fields: ['uuid']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
