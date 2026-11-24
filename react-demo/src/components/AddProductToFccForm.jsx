// src/components/AddProductToFccForm.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { showAppToast } from './CatalogUI';

const CONTROLLER_TYPES = ['Control Kit', 'Remote', 'Receiver'];

const EMPTY_SELECTIONS = {
  'Control Kit': '',
  Remote: '',
  Receiver: ''
};

export default function AddProductToFccForm({
  fccId,
  onAdd,
  filteredAvailableProducts = []
}) {
  const [selections, setSelections] = useState(EMPTY_SELECTIONS);
  const [associateLoading, setAssociateLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelections(EMPTY_SELECTIONS);
    setError('');
  }, [fccId]);

  const productsByType = useMemo(() => {
    const grouped = {
      'Control Kit': [],
      Remote: [],
      Receiver: []
    };
    filteredAvailableProducts.forEach((product) => {
      const normalized = (product.productType || '').trim().toLowerCase();
      const matchedType = CONTROLLER_TYPES.find((t) => t.toLowerCase() === normalized);
      if (matchedType) {
        grouped[matchedType].push(product);
      }
    });
    return grouped;
  }, [filteredAvailableProducts]);

  const selectedEntries = CONTROLLER_TYPES.map((type) => ({
    type,
    productId: selections[type]
  })).filter((entry) => Boolean(entry.productId));

  const handleSelectChange = (type, value) => {
    setSelections((prev) => ({ ...prev, [type]: value }));
    if (error) setError('');
  };

  const handleAssociateControllers = async () => {
    if (selectedEntries.length === 0) {
      setError('请至少选择一个要关联的控制器');
      return;
    }

    setAssociateLoading(true);
    setError('');
    try {
      const results = await Promise.all(
        selectedEntries.map(async ({ type, productId }) => {
          const response = await fetchWithAuth(`/api/fccs/${fccId}/products`, {
            method: 'POST',
            body: JSON.stringify({ productId })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg =
              errorData.code === 'ALREADY_ASSOCIATED'
                ? `${type} 中所选控制器已关联`
                : errorData.message || `${type} 关联失败`;
            return { type, ok: false, message: msg };
          }

          return { type, ok: true };
        })
      );

      const succeededTypes = results.filter((r) => r.ok).map((r) => r.type);
      const failedResults = results.filter((r) => !r.ok);

      if (succeededTypes.length > 0) {
        setSelections((prev) => {
          const next = { ...prev };
          succeededTypes.forEach((t) => {
            next[t] = '';
          });
          return next;
        });
        if (onAdd) onAdd();
        showAppToast(
          succeededTypes.length > 1
            ? `已成功关联 ${succeededTypes.length} 款控制器`
            : '控制器关联成功',
          'success'
        );
      }

      if (failedResults.length > 0) {
        setError(failedResults.map((r) => r.message).join('；'));
      }
    } catch (err) {
      setError(err.message || '关联失败，请稍后重试');
    } finally {
      setAssociateLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">关联控制器</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          从产品库中选择该FCCID产品适配的控制器
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-3.5">
        {CONTROLLER_TYPES.map((type) => {
          const options = productsByType[type] || [];
          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  {type}
                </label>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  可选 {options.length} 款
                </span>
              </div>
              <select
                value={selections[type]}
                onChange={(e) => handleSelectChange(type, e.target.value)}
                disabled={options.length === 0 || associateLoading}
                className="w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {options.length > 0 ? `-- 请选择 ${type} --` : `暂无可选的 ${type}`}
                </option>
                {options.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.model}
                    {product.sku ? ` (${product.sku})` : ''}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleAssociateControllers}
        disabled={selectedEntries.length === 0 || associateLoading}
        className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
      >
        <Link2 className="w-4 h-4" />
        {associateLoading
          ? '关联中...'
          : selectedEntries.length > 1
            ? `关联已选 ${selectedEntries.length} 款控制器`
            : '关联控制器'}
      </button>
    </div>
  );
}
