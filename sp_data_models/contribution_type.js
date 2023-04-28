module.exports = (sequelize, type) => {
    return sequelize.define('contribution_type_list', {
        id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: type.STRING(50),
            allowNull: false
        }
    }, {
            indexes: [
                {
                    unique: true,
                    name: 'name_idx',
                    fields: ['name']
                }
            ],
            freezeTableName: true,
            timestamps: false
        });
};