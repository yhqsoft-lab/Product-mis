// src/pages/FccManagement.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Package,
  Pencil,
  Trash2,
  X,
  Upload,
  Check
} from 'lucide-react';
import { useUser } from '../context/useUser';
import ConfirmDialog from '../components/ConfirmDialog';
import AddProductToFccForm from '../components/AddProductToFccForm';
import FccProductList from '../components/FccProductList';
import { safeFetch } from '../utils/safeFetch';
import { useFooterRight } from '../components/DashboardLayout';
import {
  formatMediaUrl,
  MediaThumb,
  PageToolbar,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  showAppToast,
  ProductDetailModal,
  FccControllerTabs,
  FccDetailModal
} from '../components/CatalogUI';

// 保持对外导出兼容
export const formatImageUrl = formatMediaUrl;

export default function FccManagement() {
  const { user, token, loading: isUserLoading } = useUser();
  const navigate = useNavigate();

  // FCC 管理状态
  const [fccs, setFccs] = useState([]);
  useFooterRight(fccs.length > 0 ? `当前显示 ${fccs.length} 条 FCC 记录` : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingFcc, setEditingFcc] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 记录下拉框是否处于自定义输入模式
  const [customFields, setCustomFields] = useState({
    brand: false,
    productType: false,
    speed: false
  });

  // 关联控制器管理状态
  const [selectedFcc, setSelectedFcc] = useState(null);
  const [products, setProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productManagementLoading, setProductManagementLoading] = useState(false);
  const [productManagementError, setProductManagementError] = useState('');
  const [showProductManagement, setShowProductManagement] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailFcc, setDetailFcc] = useState(null);

  // 删除对话框状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');

  const rawApiBase = process.env.REACT_APP_API_BASE || '';
  const BASE_URL = /^https?:\/\//i.test(rawApiBase) ? rawApiBase.replace(/\/+$/, '') : '';
  const API_URL = `${BASE_URL}/api/fccs`;
  const PRODUCT_API_URL = `${BASE_URL}/api/products`;
  const IMAGE_BASE_URL = BASE_URL;

  const [newFcc, setNewFcc] = useState({
    name: '',
    brand: '',
    productType: '',
    speed: '',
    description: ''
  });

  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const BRAND_OPTIONS = [
    { value: '', label: '请选择品牌' },
    { value: 'Hunter', label: 'Hunter' },
    { value: 'Harbor Breeze', label: 'Harbor Breeze' },
    { value: 'Hampton Bay', label: 'Hampton Bay' },
    { value: 'CoreBay', label: 'CoreBay' },
    { value: 'Others', label: '其他 (Other)' }
  ];

  const PRODUCT_TYPE_OPTIONS = [
    { value: '', label: '请选择产品类型' },
    { value: 'Ceiling Fan', label: 'Ceiling Fan' },
    { value: 'Control Kit', label: 'Control Kit' },
    { value: 'Remote', label: 'Remote' },
    { value: 'Receiver', label: 'Receiver' },
    { value: 'Others', label: '其他 (Other)' }
  ];

  const SPEED_OPTIONS = [
    { value: '', label: '请选择 AC/DC 类型' },
    { value: 'AC 3-speeds', label: 'AC 3-speeds' },
    { value: 'AC 3-speeds with Reverse', label: 'AC 3-speeds with Reverse' },
    { value: 'AC 4-speeds', label: 'AC 4-speeds' },
    { value: 'AC 4-speeds with Reverse', label: 'AC 4-speeds with Reverse' },
    { value: 'DC 6-speeds', label: 'DC 6-speeds' },
    { value: 'DC 6-speeds with Reverse', label: 'DC 6-speeds with Reverse' },
    { value: 'Others', label: '其他 (Other)' }
  ];

  const getAuthHeaders = useCallback(() => {
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const fetchFccs = useCallback(async (search = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = search ? `${API_URL}?search=${encodeURIComponent(search)}` : API_URL;
      const res = await safeFetch(url, { headers: getAuthHeaders() });

      if (!res.ok) {
        if (res.status === 401) throw new Error('认证失效，请重新登录');
        if (res.status === 403) throw new Error('权限不足，无法访问');
        throw new Error(`请求失败: ${res.status}`);
      }

      const data = await res.json();
      setFccs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取FCC列表失败:', err);
      setError(err.message);
      setFccs([]);
      if (err.message.includes('认证') || err.message.includes('401')) {
        navigate('/login', { replace: true });
      }
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [API_URL, getAuthHeaders, navigate]);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user && !token) {
      navigate('/login', { replace: true });
    }
  }, [user, token, isUserLoading, navigate]);

  useEffect(() => {
    if (isUserLoading || (!user && !token)) return;
    if (searchTerm.trim() === '') {
      fetchFccs();
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetchFccs(searchTerm);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchFccs, isUserLoading, user, token]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim() === '') setSearching(false);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearching(false);
  };

  const fetchAvailableProducts = useCallback(async () => {
    try {
      const res = await safeFetch(PRODUCT_API_URL, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('获取产品列表失败');
      const data = await res.json();
      setAvailableProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取可选产品失败:', err);
      setProductManagementError('获取可选产品失败');
    }
  }, [PRODUCT_API_URL, getAuthHeaders]);

  const fetchProducts = useCallback(async () => {
    if (!selectedFcc) return;
    setProductManagementLoading(true);
    setProductManagementError('');
    try {
      const res = await safeFetch(`${API_URL}/${selectedFcc.id}/products`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('获取关联产品失败');
      const data = await res.json();
      const nextProducts = Array.isArray(data) ? data : [];
      setProducts(nextProducts);
      setFccs((prev) =>
        prev.map((item) =>
          item.id === selectedFcc.id ? { ...item, Products: nextProducts } : item
        )
      );
    } catch (err) {
      console.error('获取关联产品失败:', err);
      setProductManagementError(err.message);
    } finally {
      setProductManagementLoading(false);
    }
  }, [API_URL, selectedFcc, getAuthHeaders]);

  const productMap = useMemo(() => {
    const map = new Map();
    availableProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [availableProducts]);

  const getRelatedProducts = useCallback(
    (ids) => {
      if (!Array.isArray(ids) || ids.length === 0) return [];
      return availableProducts.filter((p) => ids.includes(p.id));
    },
    [availableProducts]
  );

  const handleSelectProduct = useCallback(
    (product) => {
      if (!product) return;
      setSelectedProduct(productMap.get(product.id) || product);
    },
    [productMap]
  );

  useEffect(() => {
    if (isUserLoading || (!user && !token)) return;
    fetchAvailableProducts();
  }, [fetchAvailableProducts, isUserLoading, user, token]);

  useEffect(() => {
    if (showProductManagement && selectedFcc) {
      fetchProducts();
    }
  }, [showProductManagement, selectedFcc, fetchProducts]);

  const filteredAvailableProducts = useMemo(() => {
    const allowedTypes = new Set(['control kit', 'remote', 'receiver']);
    const associatedIds = new Set(products.map((p) => p.id));
    return availableProducts.filter((p) => {
      const normalizedType = (p.productType || '').trim().toLowerCase();
      return allowedTypes.has(normalizedType) && !associatedIds.has(p.id);
    });
  }, [availableProducts, products]);

  const handleAddSuccess = () => {
    fetchProducts();
  };

  const handleRemoveProduct = async (productId) => {
    try {
      const res = await safeFetch(`${API_URL}/${selectedFcc.id}/products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '移除失败');
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setFccs((prev) =>
        prev.map((item) =>
          item.id === selectedFcc.id
            ? {
                ...item,
                Products: (Array.isArray(item.Products) ? item.Products : []).filter(
                  (p) => p.id !== productId
                )
              }
            : item
        )
      );
      showAppToast('已移除关联控制器', 'success');
    } catch (err) {
      console.error('移除关联控制器失败:', err);
      showAppToast(`移除失败：${err.message}`, 'error');
    }
  };

  const openProductManagement = (fcc) => {
    setSelectedFcc(fcc);
    setShowProductManagement(true);
    setProducts([]);
    setProductManagementError('');
  };

  const closeProductManagement = () => {
    setSelectedFcc(null);
    setShowProductManagement(false);
    setProducts([]);
    setProductManagementError('');
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type || '';
    const fileName = file.name || '';
    const isImageMime = fileType.startsWith('image/');
    const isImageExt = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

    if (!isImageMime && !isImageExt) {
      showAppToast('请上传 JPG、PNG、GIF 或 WebP 格式的图片', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAppToast('图片不能超过 5MB', 'error');
      e.target.value = '';
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPreview(event.target.result);
      }
    };
    reader.onerror = () => {
      showAppToast('图片读取失败', 'error');
      setImageFile(null);
      setPreview('');
    };
    reader.readAsDataURL(file);
  };

  const toggleModal = () => {
    setShowModal((prev) => !prev);
    setEditingFcc(null);
    setFormErrors({});
    setNewFcc({ name: '', brand: '', productType: '', speed: '', description: '' });
    setPreview('');
    setImageFile(null);
    setCustomFields({ brand: false, productType: false, speed: false });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewFcc((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    if (value === 'Others') {
      setCustomFields((prev) => ({ ...prev, [name]: true }));
      setNewFcc((prev) => ({ ...prev, [name]: '' }));
    } else {
      setCustomFields((prev) => ({ ...prev, [name]: false }));
      setNewFcc((prev) => ({ ...prev, [name]: value }));
    }
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const cancelCustomField = (fieldName) => {
    setCustomFields((prev) => ({ ...prev, [fieldName]: false }));
    setNewFcc((prev) => ({ ...prev, [fieldName]: '' }));
    if (formErrors[fieldName]) {
      setFormErrors((prev) => ({ ...prev, [fieldName]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!newFcc.name?.trim()) {
      errors.name = 'FCC ID 不能为空';
    } else if (newFcc.name.trim().length < 3) {
      errors.name = 'FCC ID 至少 3 个字符';
    }

    if (!newFcc.brand?.trim()) errors.brand = '请选择或输入品牌';
    if (!newFcc.productType?.trim()) errors.productType = '请选择或输入产品类型';
    if (!newFcc.speed?.trim()) errors.speed = '请选择或输入 AC/DC 类型';

    if (newFcc.description && newFcc.description.length > 500) {
      errors.description = '描述不能超过 500 个字符';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('name', newFcc.name.trim());
    formData.append('description', newFcc.description?.trim() || '');
    formData.append('brand', newFcc.brand.trim());
    formData.append('productType', newFcc.productType.trim());
    formData.append('speed', newFcc.speed.trim());

    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const method = editingFcc ? 'PUT' : 'POST';
      const url = editingFcc ? `${API_URL}/${editingFcc.id}` : API_URL;

      const res = await safeFetch(url, {
        method,
        headers: getAuthHeaders(),
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP 错误: ${res.status}`);
      }

      const data = await res.json();

      if (editingFcc) {
        setFccs((prev) => prev.map((f) => (f.id === data.id ? { ...f, ...data } : f)));
        showAppToast('FCC 信息已更新', 'success');
      } else {
        setFccs((prev) => [data, ...prev]);
        showAppToast('FCC 信息已添加', 'success');
      }

      toggleModal();
      fetchFccs(searchTerm);
    } catch (err) {
      console.error('操作失败:', err);
      showAppToast(`操作失败：${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (fcc) => {
    setEditingFcc(fcc);
    setFormErrors({});
    setImageFile(null);
    setNewFcc({
      name: fcc.name || '',
      brand: fcc.brand || '',
      productType: fcc.productType || '',
      speed: fcc.speed || '',
      description: fcc.description || ''
    });

    setCustomFields({
      brand: fcc.brand ? !BRAND_OPTIONS.some((opt) => opt.value === fcc.brand) : false,
      productType: fcc.productType ? !PRODUCT_TYPE_OPTIONS.some((opt) => opt.value === fcc.productType) : false,
      speed: fcc.speed ? !SPEED_OPTIONS.some((opt) => opt.value === fcc.speed) : false
    });

    setPreview(formatMediaUrl(fcc.image, IMAGE_BASE_URL) || '');
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await safeFetch(`${API_URL}/${deleteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '删除失败');
      }

      setFccs((prev) => prev.filter((f) => f.id !== deleteId));
      showAppToast(`"${deleteTargetName}" 已删除`, 'success');
    } catch (err) {
      console.error('删除失败:', err);
      showAppToast(`删除失败：${err.message}`, 'error');
    } finally {
      setShowDeleteDialog(false);
      setDeleteId(null);
      setDeleteTargetName('');
    }
  };

  const handleDeleteClick = (fcc) => {
    setDeleteId(fcc.id);
    setDeleteTargetName(fcc.name || fcc.id);
    setShowDeleteDialog(true);
  };

  const renderFccList = () => {
    if (loading) {
      return <CardGridSkeleton count={6} />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={() => fetchFccs(searchTerm)} />;
    }

    if (fccs.length === 0) {
      return (
        <EmptyState
          title={searchTerm ? '未找到相关 FCC ID' : '暂无 FCC 记录'}
          description={
            searchTerm
              ? `没有找到包含 "${searchTerm}" 的 FCC 记录，请尝试其他关键词。`
              : '当前还没有任何 FCC ID 记录，点击下方按钮添加第一条记录。'
          }
          actionLabel={searchTerm ? '查看所有 FCC ID' : '添加第一条 FCC'}
          onAction={searchTerm ? clearSearch : toggleModal}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {fccs.map((fcc) => (
          <article
            key={fcc.id}
            className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
          >
            {/* 上半部分：正方形图片 + FCC 核心信息（与前台 FccView 保持完全一致） */}
            <div className="flex flex-row border-b border-slate-100">
              <div className="w-36 sm:w-40 aspect-square shrink-0 bg-slate-50 border-r border-slate-100 overflow-hidden">
                <MediaThumb
                  src={formatMediaUrl(fcc.image, IMAGE_BASE_URL)}
                  alt={fcc.name || 'FCC 图片'}
                  className="w-full h-full aspect-square object-cover"
                />
              </div>

              <div className="flex-1 min-w-0 p-3.5 sm:p-4 flex flex-col justify-center gap-2.5">
                <div className="min-w-0">
                  <h3
                    className="text-[15px] font-semibold font-mono text-slate-900 truncate leading-snug"
                    title={fcc.name || ''}
                  >
                    <span className="font-sans text-xs font-medium text-slate-400">FCCID：</span>
                    {fcc.name || '—'}
                  </h3>
                </div>

                <dl className="space-y-1.5 text-xs">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <dt className="text-slate-400 shrink-0 w-10">品牌</dt>
                    <dd className="text-slate-700 font-medium truncate">{fcc.brand || '—'}</dd>
                  </div>
                  <div className="flex items-baseline gap-2 min-w-0">
                    <dt className="text-slate-400 shrink-0 w-10">类型</dt>
                    <dd className="text-slate-700 font-medium truncate">{fcc.productType || '—'}</dd>
                  </div>
                  <div className="flex items-baseline gap-2 min-w-0">
                    <dt className="text-slate-400 shrink-0 w-10">规格</dt>
                    <dd className="text-slate-700 truncate" title={fcc.speed || ''}>
                      {fcc.speed || '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* 中间：描述 */}
            <div className="px-4 py-3 flex-1 bg-white">
              <p className="text-xs font-medium text-slate-400 mb-1">描述</p>
              <p
                className="text-sm text-slate-600 line-clamp-2 leading-relaxed min-h-[2.625rem]"
                title={fcc.description || ''}
              >
                {fcc.description || '暂无描述'}
              </p>
            </div>

            {/* 适配的控制器 Tab 区（与前台 FCCID 查询卡片风格保持一体） */}
            <FccControllerTabs
              fccProducts={fcc.Products}
              onSelectProduct={handleSelectProduct}
              baseUrl={IMAGE_BASE_URL}
              className="mt-auto"
            />

            {/* 底部管理操作栏 */}
            <div className="px-4 py-2.5 border-t border-slate-200/70 bg-white">
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDetailFcc(fcc)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  详情
                </button>
                <button
                  type="button"
                  onClick={() => openProductManagement(fcc)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors whitespace-nowrap"
                >
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  适配
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(fcc)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-50 transition-colors whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5 shrink-0" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(fcc)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-medium hover:bg-rose-50 transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderProductManagement = () => {
    if (!showProductManagement || !selectedFcc) return null;

    return (
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col shadow-xl">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">
                管理适配控制器 — <span className="font-mono">{selectedFcc.name || selectedFcc.id}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {selectedFcc.brand || '无品牌'}
                <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                {selectedFcc.productType || '无类型'}
                {selectedFcc.speed ? (
                  <>
                    <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                    {selectedFcc.speed}
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={closeProductManagement}
              aria-label="关闭"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 bg-slate-50/40">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200">
                <AddProductToFccForm
                  fccId={selectedFcc.id}
                  onAdd={handleAddSuccess}
                  availableProducts={availableProducts}
                  filteredAvailableProducts={filteredAvailableProducts}
                />
              </div>
              <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200">
                <FccProductList
                  products={products}
                  loading={productManagementLoading}
                  error={productManagementError}
                  onRemove={handleRemoveProduct}
                  baseUrl={IMAGE_BASE_URL}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const subtitleText = searchTerm && !loading
    ? `搜索 "${searchTerm}" · 共 ${fccs.length} 条记录`
    : loading
      ? '正在同步 FCC ID 记录...'
      : `共 ${fccs.length} 条 FCC 记录`;

  return (
    <div>
      <PageToolbar
        title="FCCID 信息管理"
        subtitle={subtitleText}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        searchPlaceholder="输入 FCC ID、品牌或描述关键词搜索..."
        searching={searching}
        loading={loading}
        actionButton={
          <button
            type="button"
            onClick={toggleModal}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            添加 FCC
          </button>
        }
      />

      {renderFccList()}

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="删除 FCC 记录"
        message={`确定要删除 "${deleteTargetName}" 吗？此操作不可恢复。`}
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteDialog(false);
          setDeleteId(null);
          setDeleteTargetName('');
        }}
        isDanger={true}
      />

      {renderProductManagement()}

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        getRelatedProducts={getRelatedProducts}
        baseUrl={IMAGE_BASE_URL}
      />

      <FccDetailModal
        fcc={detailFcc}
        onClose={() => setDetailFcc(null)}
        baseUrl={IMAGE_BASE_URL}
      />

      {/* 新增 / 编辑 FCC 模态框 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <h2 className="text-base font-semibold text-slate-900">
                {editingFcc ? '编辑 FCC 信息' : '添加新 FCC'}
              </h2>
              <button
                type="button"
                onClick={toggleModal}
                aria-label="关闭"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. FCC ID */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      FCC ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={newFcc.name}
                      onChange={handleInputChange}
                      className={`w-full h-10 px-3 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                        formErrors.name ? 'border-rose-400' : 'border-slate-200'
                      }`}
                      placeholder="例如: 2AOKB-XYZ123"
                      maxLength={50}
                    />
                    {formErrors.name && (
                      <p className="text-rose-600 text-xs mt-1" role="alert">{formErrors.name}</p>
                    )}
                  </div>

                  {/* 2. Brand */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      品牌 (Brand) <span className="text-rose-500">*</span>
                    </label>
                    {!customFields.brand ? (
                      <select
                        name="brand"
                        value={newFcc.brand}
                        onChange={handleSelectChange}
                        className={`w-full h-10 px-3 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                          formErrors.brand ? 'border-rose-400' : 'border-slate-200'
                        }`}
                      >
                        {BRAND_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          name="brand"
                          value={newFcc.brand}
                          onChange={handleInputChange}
                          autoFocus
                          className={`w-full h-10 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                            formErrors.brand ? 'border-rose-400' : 'border-slate-200'
                          }`}
                          placeholder="请输入自定义 Brand"
                        />
                        <button
                          type="button"
                          onClick={() => cancelCustomField('brand')}
                          title="返回下拉选择"
                          className="h-10 w-10 inline-flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {formErrors.brand && (
                      <p className="text-rose-600 text-xs mt-1" role="alert">{formErrors.brand}</p>
                    )}
                  </div>

                  {/* 3. 产品类型 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      产品类型 <span className="text-rose-500">*</span>
                    </label>
                    {!customFields.productType ? (
                      <select
                        name="productType"
                        value={newFcc.productType}
                        onChange={handleSelectChange}
                        className={`w-full h-10 px-3 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                          formErrors.productType ? 'border-rose-400' : 'border-slate-200'
                        }`}
                      >
                        {PRODUCT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          name="productType"
                          value={newFcc.productType}
                          onChange={handleInputChange}
                          autoFocus
                          className={`w-full h-10 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                            formErrors.productType ? 'border-rose-400' : 'border-slate-200'
                          }`}
                          placeholder="请输入自定义产品类型"
                        />
                        <button
                          type="button"
                          onClick={() => cancelCustomField('productType')}
                          title="返回下拉选择"
                          className="h-10 w-10 inline-flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {formErrors.productType && (
                      <p className="text-rose-600 text-xs mt-1" role="alert">{formErrors.productType}</p>
                    )}
                  </div>

                  {/* 4. AC/DC 类型 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      AC/DC 规格 <span className="text-rose-500">*</span>
                    </label>
                    {!customFields.speed ? (
                      <select
                        name="speed"
                        value={newFcc.speed}
                        onChange={handleSelectChange}
                        className={`w-full h-10 px-3 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                          formErrors.speed ? 'border-rose-400' : 'border-slate-200'
                        }`}
                      >
                        {SPEED_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          name="speed"
                          value={newFcc.speed}
                          onChange={handleInputChange}
                          autoFocus
                          className={`w-full h-10 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                            formErrors.speed ? 'border-rose-400' : 'border-slate-200'
                          }`}
                          placeholder="请输入自定义 AC/DC 类型"
                        />
                        <button
                          type="button"
                          onClick={() => cancelCustomField('speed')}
                          title="返回下拉选择"
                          className="h-10 w-10 inline-flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {formErrors.speed && (
                      <p className="text-rose-600 text-xs mt-1" role="alert">{formErrors.speed}</p>
                    )}
                  </div>
                </div>

                {/* 产品描述 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700">产品描述</label>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {newFcc.description?.length || 0}/500
                    </span>
                  </div>
                  <textarea
                    name="description"
                    value={newFcc.description}
                    onChange={handleInputChange}
                    rows="3"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                      formErrors.description ? 'border-rose-400' : 'border-slate-200'
                    }`}
                    placeholder="请输入产品详细描述（可选，最多 500 字）..."
                    maxLength={500}
                  />
                  {formErrors.description && (
                    <p className="text-rose-600 text-xs mt-1" role="alert">{formErrors.description}</p>
                  )}
                </div>

                {/* 产品图片 */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">产品图片</label>
                  <div className="space-y-3">
                    <div className="flex items-center flex-wrap gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5" />
                        <span>选择图片</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleImageChange}
                          className="hidden"
                          id="fcc-image-upload"
                        />
                      </label>
                      <span className="text-xs text-slate-400">支持 JPG/PNG/GIF/WebP，≤ 5MB</span>
                    </div>

                    {preview && (
                      <div className="relative w-32 h-32 aspect-square border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <MediaThumb src={preview} alt="FCC 图片预览" />
                        <button
                          type="button"
                          onClick={() => {
                            setPreview('');
                            setImageFile(null);
                            const fileInput = document.getElementById('fcc-image-upload');
                            if (fileInput) fileInput.value = '';
                          }}
                          aria-label="移除图片"
                          className="absolute top-1.5 right-1.5 p-1 bg-slate-900/60 text-white rounded-md hover:bg-slate-900/80 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={toggleModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSubmitting ? '处理中...' : editingFcc ? '保存修改' : '添加 FCC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
