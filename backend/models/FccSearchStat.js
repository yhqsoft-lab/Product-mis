// backend/models/FccSearchStat.js
module.exports = (sequelize, DataTypes) => {
  const FccSearchStat = sequelize.define(
    'FccSearchStat',
    {
      keywordKey: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      keyword: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      searchCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      lastSearchedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'fcc_search_stats',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['keywordKey'],
          name: 'uniq_fcc_search_stats_keyword_key'
        },
        {
          fields: ['searchCount', 'lastSearchedAt'],
          name: 'idx_fcc_search_stats_hot'
        }
      ]
    }
  );

  return FccSearchStat;
};
