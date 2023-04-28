module.exports = (sequelize, type) => {
    return sequelize.define('tag_list', {
    id: {
      type: type.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    tag: {
      type: type.STRING(30),
      allowNull: false
    },
    creator_uuid: {
        type: type.STRING(36),
      allowNull: false
    }
  }, {
    indexes: [
      {
            unique: true,
            name: 'tag_UNIQUE',
        fields: ['tag']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
