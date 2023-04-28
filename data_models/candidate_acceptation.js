module.exports = (sequelize, type) => {
    return sequelize.define('candidate_acceptation', {
        id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        author_uuid: {
            type: type.UUID,
            allowNull: false
        },
        candidate_id: {
            type: type.INTEGER,
            allowNull: false
        },
        contribution_id: {
            type: type.INTEGER,
            allowNull: false
        },
        candidate_uuid: {
            type: type.UUID,
            allowNull: false
        },
        accepted: {
            type: type.BOOLEAN,
            allowNull: true
        },
        rejected: {
            type: type.BOOLEAN,
            allowNull: true
        },
        pending: {
            type: type.BOOLEAN,
            allowNull: true
        },
        price: {
            type: type.DOUBLE(10, 2),
            allowNull: true
        },
        fieldsChanged: {
            type: type.STRING(255),
            allowNull: true
        },
        created: {
            type: type.DATE,
            allowNull: true
        },
        acceptationDatetime: {
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
        reserved: {
            type: type.BOOLEAN,
            allowNull: true
        },
        platform: {
            type: type.STRING(50),
            allowNull: true
        },
    }, {
        indexes: [
            {
                unique: true,
                name: 'contribution_caix',
                fields: ['contribution_id']
            }
        ],
        freezeTableName: true,
        timestamps: false
    });
};