module.exports = (sequelize, type) => {
    return sequelize.define('user_filters', {
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
        filter_group_id: {
            type: type.INTEGER(11),
            allowNull: true
        },
        filter_value: {
            type: type.STRING(255),
            allowNull: true
        },
        filterType: {
            type: type.STRING(10),
            allowNull: false
        }
    }, {
        indexes: [
            {
                unique: true,
                name: 'uuid_uffk_idx',
                fields: ['uuid']
            }
        ],
        freezeTableName: true,
        timestamps: false
        });
};