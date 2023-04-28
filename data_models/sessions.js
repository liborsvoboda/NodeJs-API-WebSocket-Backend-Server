module.exports = (sequelize, type) => {
  return sequelize.define('sessions', {
    session: {
      type: type.UUID,
      primaryKey: true,
      defaultValue: type.UUIDV4,
      allowNull: false
    },
    ip: {
      type: type.STRING(15),
      allowNull: false
    },
    uuid: {
      type: type.UUID,
      allowNull: false
    },
    lastActivity: {
      type: type.INTEGER(11),
      allowNull: false
    }
  }, {
    freezeTableName: true,
    timestamps: false
  });
};
