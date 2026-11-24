// src/hooks/useDropdownOptions.js
import { useState, useEffect, useCallback } from 'react';
import { safeFetch } from '../utils/safeFetch';

const EMPTY_OPTIONS = {
  brand: [],
  productType: [],
  speed: [],
  status: [],
  role: []
};

export function useDropdownOptions() {
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const rawApiBase = process.env.REACT_APP_API_BASE || '';
  const BASE_URL = /^https?:\/\//i.test(rawApiBase) ? rawApiBase.replace(/\/+$/, '') : '';
  const API_OPTIONS = `${BASE_URL}/api/options`;

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await safeFetch(API_OPTIONS);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `获取下拉选项失败 (${res.status})`);
      }
      const payload = await res.json();
      const grouped = payload?.data || {};
      setOptions({
        brand: Array.isArray(grouped.brand) ? grouped.brand : [],
        productType: Array.isArray(grouped.productType) ? grouped.productType : [],
        speed: Array.isArray(grouped.speed) ? grouped.speed : [],
        status: Array.isArray(grouped.status) ? grouped.status : [],
        role: Array.isArray(grouped.role) ? grouped.role : []
      });
    } catch (err) {
      console.error('❌ 加载数据库下拉选项失败:', err);
      setError(err.message || '加载下拉选项失败');
    } finally {
      setLoading(false);
    }
  }, [API_OPTIONS]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return {
    options,
    loading,
    error,
    refreshOptions: fetchOptions
  };
}
