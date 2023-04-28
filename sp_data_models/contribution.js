module.exports = (sequelize, type) => {
    return sequelize.define('contribution', {
        id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        uuid: {
            type: type.UUID,
            allowNull: false
        },
        title: {
            type: type.STRING(40),
            allowNull: false
        },
        type: {
            type: type.INTEGER,
            allowNull: false
        },
        content: {
            type: type.STRING(300),
            allowNull: false
        },
        capacityFrom: {
            type: type.DOUBLE(10, 2),
            allowNull: false
        },
        capacityTo: {
            type: type.DOUBLE(10, 2),
            allowNull: false
        },
        price: {
            type: type.DOUBLE(10, 2),
            allowNull: false
        },
        currency: {
            type: type.INTEGER,
            allowNull: false
        },
        actionDatetime: {
            type: type.DATE,
            allowNull: true
        },
        gpsLocation: {
            type: type.STRING(150),
            allowNull: true
        },
        streetAcp: {
            type: type.STRING(255),
            allowNull: true
        },
        postCode: {
            type: type.STRING(20),
            allowNull: true
        },
        city: {
            type: type.STRING(150),
            allowNull: true
        },
        priceFree: {
            type: type.BOOLEAN,
            allowNull: true
        },
        priceOwner: {
            type: type.BOOLEAN,
            allowNull: true
        },
        isPublished: {
            type: type.BOOLEAN,
            allowNull: true
        },
        insertPaymentRequired: {
            type: type.BOOLEAN,
            allowNull: true
        },
        insertPaymentPrice: {
            type: type.DOUBLE(10, 2),
            allowNull: true
        },
        videoUrl: {
            type: type.STRING(2048),
            allowNull: true
        },
        distance: {
            type: type.INTEGER,
            allowNull: true
        },
        privateAddress: {
            type: type.BOOLEAN,
            allowNull: true
        },
        platform: {
            type: type.STRING(50),
            allowNull: true
        },
        banned: {
            type: type.STRING,
            allowNull: false,
            defaultValue: false
        }
    }, {
        indexes: [
            {
                unique: true,
                name: 'uuid_flbk_idx',
                fields: ['uuid']
            }
        ],
        freezeTableName: true,
        timestamps: false
    });
};