module.exports = (sequelize, type) => {
    return sequelize.define('phone_codes', {
    id: {
      type: type.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    shortCountry: {
        type: type.STRING(3),
        allowNull: false
    },
    country: {
      type: type.STRING(150),
      allowNull: false
    },
    code: {
      type: type.STRING(10),
      allowNull: false
    }
  }, {
    indexes: [
      {
        unique: true,
        name: 'country',
        fields: ['country']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
