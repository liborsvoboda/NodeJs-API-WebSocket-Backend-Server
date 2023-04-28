module.exports = (sequelize, type) => {
    return sequelize.define('appSettings', {
        id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        paramName: {
            type: type.STRING(50),
            allowNull: false
        },
        value: {
            type: type.STRING(50),
            allowNull: false
        }
    }, {
        indexes: [
            {
                unique: true,
                name: 'paramName_uix',
                fields: ['paramName']
            }
        ],
        freezeTableName: true,
        timestamps: false
    });
};