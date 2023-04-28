module.exports = (sequelize, type) => {
    return sequelize.define('contribution_payments', {
        id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        owner_uuid: {
            type: type.UUID,
            allowNull: false
        },
        contribution_id: {
            type: type.INTEGER,
            allowNull: false
        },
        price: {
            type: type.DOUBLE(10, 2),
            allowNull: true
        },
        created: {
            type: type.DATE,
            allowNull: true
        },
        payed: {
            type: type.BOOLEAN,
            allowNull: true
        },
        checkout_url: {
            type: type.STRING(1024),
            allowNull: true
        },
        currency: {
            type: type.STRING(10),
            allowNull: true
        },
        status: {
            type: type.STRING(50),
            allowNull: true
        },
        nonce: {
            type: type.STRING(100),
            allowNull: true
        }
    }, {
        indexes: [
            {
                unique: true,
                name: 'uuid_contrib_idx',
                fields: ['owner_uuid','contribution_id']
            }
        ],
        freezeTableName: true,
        timestamps: false
    });
};