module.exports = (sequelize, type) => {
    return sequelize.define('problem_report', {
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
        reportedUuid: {
            type: type.UUID,
            allowNull: false
        },
        reason: {
            type: type.STRING(300),
            allowNull: false
        },
        contribution_id: {
            type: type.INTEGER.UNSIGNED,
            allowNull: true
        }
    }, {
        freezeTableName: true,
        timestamps: false
    });
};