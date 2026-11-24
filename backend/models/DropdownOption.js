// backend/models/DropdownOption.js
module.exports = (sequelize, DataTypes) => {
  const DropdownOption = sequelize.define(
    'DropdownOption',
    {
      category: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true
        }
      },
      value: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: {
          notEmpty: true
        }
      },
      label: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: {
          notEmpty: true
        }
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: 'dropdown_options',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['category', 'value'],
          name: 'uniq_dropdown_options_category_value'
        },
        {
          fields: ['category', 'isActive', 'sortOrder'],
          name: 'idx_dropdown_options_cat_active_sort'
        }
      ]
    }
  );

  return DropdownOption;
};
