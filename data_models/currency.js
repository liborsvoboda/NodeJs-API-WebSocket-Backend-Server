module.exports = (sequelize, type) => {
    return sequelize.define('currency_list', {
        id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        currency: {
            type: type.STRING(10),
            allowNull: false
        },
        country: {
            type: type.STRING(255),
            allowNull: false
        }
    }, {
            indexes: [
                {
                    unique: true,
                    name: 'currency_UNIQUE',
                    fields: ['currency']
                }
            ],
            freezeTableName: true,
            timestamps: false
        });
};