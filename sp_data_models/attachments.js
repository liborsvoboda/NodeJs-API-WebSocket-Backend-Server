module.exports = (sequelize, type) => {
    return sequelize.define('attachments', {
        id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        owner_uuid: {
            type: type.UUID,
            allowNull: true
        },
        name: {
            type: type.STRING(100),
            allowNull: false
        },
        mimeType: {
            type: type.STRING(50),
            allowNull: false
        },
        content: {
            type: type.BLOB('medium'),
            allowNull: false
        },
        contribution_id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: true
        },
        primaryAttachment: {
            type: type.BOOLEAN,
            allowNull: true
        }
    }, {
        indexes: [
            {
                unique: true,
                name: 'IX_uuid',
                fields: ['owner_uuid']
            }
        ],
        freezeTableName: true,
        timestamps: false
    });
};