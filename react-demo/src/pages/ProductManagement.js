// src/pages/ProductManagement.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  HardDrive,
  Eye,
  Link2,
  Pencil,
  Trash2,
  X,
  Upload,
  Check
} from 'lucide-react';
import { useUser } from '../context/useUser';
import ConfirmDialog from '../components/ConfirmDialog';
import ProductRelationsManager from '../components/ProductRelationsManager';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { safeFetch } from '../utils/safeFetch';
import { useFooterRight } from '../components/DashboardLayout';
import { useDropdownOptions } from '../hooks/useDropdownOptions';
import {
  formatMediaUrl,
  getStatusMeta,
  MediaThumb,
  PageToolbar,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  showAppToast,
  ProductDetailModal,
  ProductRelationModal,
  PaginationBar
} from '../components/CatalogUI';

const DEFAULT_PAGE_SIZE = 12;

export default function ProductManagement() {
  const { user, token, loading: isUserLoading } = useUser();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';

  // 权限校验
  useEffect(() => {
    if (isUserLoading) return;
    if (!user && !token) {
      navigate('/login', { replace: true });
      return;
    }
    if (user && user.role !== 'admin' && user.role !== 'editor') {
      navigate('/productview', { replace: true });
    }
  }, [user, token, isUserLoading, navigate]);

  // 页面状态
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [searching, setSearching] = useState(false);

  useFooterRight(
    pagination.total > 0
      ? `第 ${pagination.page} / ${Math.max(1, pagination.totalPages)} 页 · 共 ${pagination.total} 个产品`
      : ''
  );

  // Relations 状态
  const [showRelationsModal, setShowRelationsModal] = useState(false);
  const [selectedProductForRelations, setSelectedProductForRelations] = useState(null);
  const [relationModalState, setRelationModalState] = useState({
    isOpen: false,
    product: null,
    initialTab: 'compatible'
  });

  const openRelationModal = useCallback((product, tab = 'compatible') => {
    setRelationModalState({
      isOpen: true,
      product,
      initialTab: tab
    });
  }, []);

  const closeRelationModal = useCallback(() => {
    setRelationModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 文件状态
  const [imageFile, setImageFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [qaFile, setQaFile] = useState(null);
  const [preview, setPreview] = useState('');

  // 防止重复提交
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 详情模态框堆栈（支持点击关联产品弹出新详情弹窗）
  const [detailModalStack, setDetailModalStack] = useState([]);

  const openDetailModal = useCallback((product, relationLabel = '') => {
    if (!product) return;
    setDetailModalStack((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].product?.id === product.id) {
        return prev;
      }
      return [...prev, { product, relationLabel }];
    });
  }, []);

  const closeTopDetailModal = useCallback(() => {
    setDetailModalStack((prev) => prev.slice(0, -1));
  }, []);

  // 表单状态
  const [newProduct, setNewProduct] = useState({
    sku: '',
    productType: '',
    description: '',
    brand: '',
    productfccId: '',
    model: '',
    httpLink: '',
    nasLink: '',
    status: 'active',
    manual: '',
    qaDocument: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [customFields, setCustomFields] = useState({
    brand: false,
    productType: false
  });

  const rawApiBase = process.env.REACT_APP_API_BASE || '';
  const BASE_URL = /^https?:\/\//i.test(rawApiBase) ? rawApiBase.replace(/\/+$/, '') : '';
  const API_PRODUCTS = `${BASE_URL}/api/products`;

  const { options: dbOptions, refreshOptions } = useDropdownOptions();

  const BRAND_OPTIONS = useMemo(
    () => [
      { value: '', label: '请选择品牌' },
      ...dbOptions.brand.map((o) => ({ value: o.value, label: o.label || o.value })),
      { value: 'Others', label: '其他 (自定义)' }
    ],
    [dbOptions.brand]
  );

  const PRODUCT_TYPE_OPTIONS = useMemo(
    () => [
      { value: '', label: '请选择产品类型' },
      ...dbOptions.productType.map((o) => ({ value: o.value, label: o.label || o.value })),
      { value: 'Others', label: '其他 (自定义)' }
    ],
    [dbOptions.productType]
  );

  const STATUS_OPTIONS = useMemo(
    () => dbOptions.status.map((o) => ({ value: o.value, label: o.label || o.value })),
    [dbOptions.status]
  );

  const fetchProducts = useCallback(async (search = '', targetPage = 1, targetPageSize = DEFAULT_PAGE_SIZE) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(targetPageSize)
      });
      if (search.trim()) {
        params.set('search', search.trim());
      }
      const url = `${API_PRODUCTS}?${params.toString()}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
        setPagination({
          page: 1,
          pageSize: targetPageSize,
          total: data.length,
          totalPages: data.length > 0 ? Math.ceil(data.length / targetPageSize) : 0
        });
      } else {
        const items = Array.isArray(data.items) ? data.items : [];
        const nextPagination = data.pagination || {
          page: targetPage,
          pageSize: targetPageSize,
          total: items.length,
          totalPages: items.length > 0 ? 1 : 0
        };
        setProducts(items);
        setPagination(nextPagination);
        if (nextPagination.page && nextPagination.page !== targetPage) {
          setPage(nextPagination.page);
        }
      }
    } catch (err) {
      console.error('❌ 获取产品失败:', err);
      setError(err.message);
      setProducts([]);
      setPagination({ page: 1, pageSize: targetPageSize, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [API_PRODUCTS]);

  const checkUniqueField = useCallback(async (field, value, productId = null) => {
    if (!value) return '';
    try {
      const params = new URLSearchParams({ [field]: value });
      if (productId) params.append('excludeId', productId);
      const res = await fetchWithAuth(`/api/products/check-unique?${params}`);
      if (!res.ok) return '';
      const data = await res.json();
      if (data && data.unique === false) {
        return field === 'sku' ? 'SKU 已存在' : '型号已存在';
      }
    } catch (err) {
      console.error(`校验 ${field} 失败:`, err);
    }
    return '';
  }, []);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed === activeSearch) {
      setSearching(false);
      return;
    }
    if (trimmed === '') {
      setSearching(false);
      setActiveSearch('');
      setPage(1);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      setActiveSearch(trimmed);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, activeSearch]);

  useEffect(() => {
    if (isUserLoading || (!user && !token)) return;
    fetchProducts(activeSearch, page, pageSize);
  }, [activeSearch, page, pageSize, fetchProducts, isUserLoading, user, token]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim() === '') setSearching(false);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setPage(1);
    setSearching(false);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(1);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
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
      if (event.target?.result) setPreview(event.target.result);
    };
    reader.onerror = () => {
      showAppToast('图片读取失败', 'error');
      setImageFile(null);
      setPreview('');
    };
    reader.readAsDataURL(file);
  };

  const handlePdfChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      showAppToast('请上传 PDF 文件', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showAppToast('PDF 文件不能超过 10MB', 'error');
      e.target.value = '';
      return;
    }
    setPdfFile(file);
  };

  const handleQaDocChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedExt = /\.(pdf|doc|docx|xls|xlsx)$/i;
    if (!allowedExt.test(file.name)) {
      showAppToast('QA 文档仅支持 PDF、DOC、DOCX、XLS、XLSX 格式', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showAppToast('QA 文档不能超过 10MB', 'error');
      e.target.value = '';
      return;
    }
    setQaFile(file);
  };

  const openRelationsModal = (product) => {
    setSelectedProductForRelations(product);
    setShowRelationsModal(true);
  };

  const closeRelationsModal = () => {
    setShowRelationsModal(false);
    setSelectedProductForRelations(null);
  };

  const toggleModal = useCallback(() => {
    setShowModal((prev) => !prev);
    setEditingProduct(null);
    setFormErrors({});
    setNewProduct({
      sku: '',
      productType: '',
      description: '',
      brand: '',
      productfccId: '',
      model: '',
      httpLink: '',
      nasLink: '',
      status: 'active',
      manual: '',
      qaDocument: ''
    });
    setPreview('');
    setImageFile(null);
    setPdfFile(null);
    setQaFile(null);
    setCustomFields({ brand: false, productType: false });
  }, []);

  // Esc 快捷键关闭新增/编辑弹窗
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        toggleModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, isSubmitting, toggleModal]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // 下拉选择处理：选“其他”切换为自定义文本输入
  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    if (value === 'Others') {
      setCustomFields((prev) => ({ ...prev, [name]: true }));
      setNewProduct((prev) => ({ ...prev, [name]: '' }));
    } else {
      setCustomFields((prev) => ({ ...prev, [name]: false }));
      setNewProduct((prev) => ({ ...prev, [name]: value }));
    }
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // 退出自定义输入，切回下拉选择
  const cancelCustomField = (fieldName) => {
    setCustomFields((prev) => ({ ...prev, [fieldName]: false }));
    setNewProduct((prev) => ({ ...prev, [fieldName]: '' }));
    if (formErrors[fieldName]) {
      setFormErrors((prev) => ({ ...prev, [fieldName]: null }));
    }
  };

  const isValidUrl = (url) => {
    if (!url?.trim()) return true;
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isValidNasLink = (link) => {
    const trimmed = (link || '').trim();
    if (!trimmed) return true;
    if (/^(javascript|vbscript|data):/i.test(trimmed)) return false;
    return /^(https?:\/\/|smb:\/\/|\\\\|\/)/i.test(trimmed);
  };

  const validateForm = () => {
    const errors = {};
    if (!newProduct.sku?.trim()) errors.sku = 'SKU 不能为空';
    if (!newProduct.model?.trim()) errors.model = 'Model 不能为空';
    if (!newProduct.productType?.trim()) errors.productType = '请选择或输入产品类型';
    if (newProduct.httpLink && !isValidUrl(newProduct.httpLink)) {
      errors.httpLink = '请输入有效的 http:// 或 https:// 链接';
    }
    if (newProduct.nasLink && !isValidNasLink(newProduct.nasLink)) {
      errors.nasLink = '请输入有效的 NAS 链接（支持 http(s)://、smb:// 或 \\\\路径）';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (isSubmitting) return;

    if (!token) {
      showAppToast('身份验证已过期，请重新登录', 'error');
      navigate('/login');
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedSku = newProduct.sku.trim();
      const trimmedModel = newProduct.model.trim();
      const trimmedBrand = newProduct.brand.trim();
      const trimmedFccId = (newProduct.productfccId || '').trim();
      const trimmedType = newProduct.productType.trim();
      const trimmedDesc = (newProduct.description || '').trim();
      const trimmedLink = (newProduct.httpLink || '').trim();
      const trimmedNasLink = (newProduct.nasLink || '').trim();
      const statusVal = newProduct.status || 'active';

      const [skuDupMsg, modelDupMsg] = await Promise.all([
        checkUniqueField('sku', trimmedSku, editingProduct?.id),
        checkUniqueField('model', trimmedModel, editingProduct?.id)
      ]);

      if (skuDupMsg || modelDupMsg) {
        setFormErrors((prev) => ({
          ...prev,
          ...(skuDupMsg ? { sku: skuDupMsg } : {}),
          ...(modelDupMsg ? { model: modelDupMsg } : {})
        }));
        showAppToast('请修正重复的 SKU 或型号', 'error');
        return;
      }

      const hasNewFiles = imageFile || pdfFile || qaFile;
      const isEditing = !!editingProduct;
      const url = isEditing ? `${API_PRODUCTS}/${newProduct.id}` : API_PRODUCTS;

      let response;
      if (hasNewFiles) {
        const formData = new FormData();
        formData.append('sku', trimmedSku);
        formData.append('model', trimmedModel);
        formData.append('description', trimmedDesc);
        formData.append('brand', trimmedBrand);
        formData.append('productfccId', trimmedFccId);
        formData.append('productType', trimmedType);
        formData.append('status', statusVal);
        formData.append('httpLink', trimmedLink);
        formData.append('nasLink', trimmedNasLink);
        if (imageFile) {
          formData.append('image', imageFile);
        } else if (isEditing && newProduct.image === null) {
          formData.append('removeImage', 'true');
        }
        if (pdfFile) {
          formData.append('manual', pdfFile);
        } else if (isEditing && newProduct.manual === null) {
          formData.append('removeManual', 'true');
        }
        if (qaFile) {
          formData.append('qaDocument', qaFile);
        } else if (isEditing && newProduct.qaDocument === null) {
          formData.append('removeQaDocument', 'true');
        }

        response = await safeFetch(url, {
          method: isEditing ? 'PUT' : 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
      } else {
        const jsonData = {
          sku: trimmedSku,
          model: trimmedModel,
          description: trimmedDesc,
          brand: trimmedBrand,
          productfccId: trimmedFccId,
          productType: trimmedType,
          status: statusVal,
          httpLink: trimmedLink,
          nasLink: trimmedNasLink
        };

        if (isEditing) {
          if (newProduct.image === null) jsonData.image = null;
          else if (newProduct._hasImage) jsonData.image = newProduct.image;

          if (newProduct.manual === null) jsonData.manual = null;
          else if (newProduct._hasManual) jsonData.manual = newProduct.manual;

          if (newProduct.qaDocument === null) jsonData.qaDocument = null;
          else if (newProduct._hasQaDocument) jsonData.qaDocument = newProduct.qaDocument;
        }

        response = await safeFetch(url, {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(jsonData)
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText.substring(0, 200);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (isEditing) {
        setProducts((prev) => prev.map((p) => (p.id === data.id ? { ...p, ...data } : p)));
        showAppToast('产品更新成功', 'success');
      } else {
        showAppToast('产品添加成功', 'success');
      }
      toggleModal();
      const targetPage = isEditing ? page : 1;
      if (!isEditing && page !== 1) {
        setPage(1);
      } else {
        fetchProducts(activeSearch, targetPage, pageSize);
      }
      refreshOptions();
    } catch (err) {
      console.error('💥 提交失败:', err);
      showAppToast(`操作失败：${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormErrors({});
    setImageFile(null);
    setPdfFile(null);
    setQaFile(null);
    setNewProduct({
      ...product,
      productfccId: product.productfccId || '',
      nasLink: product.nasLink || '',
      status: product.status || 'active',
      _hasImage: !!product.image,
      _hasManual: !!product.manual,
      _hasQaDocument: !!product.qaDocument
    });
    const presetBrands = BRAND_OPTIONS.map((o) => o.value).filter((v) => v && v !== 'Others');
    const presetTypes = PRODUCT_TYPE_OPTIONS.map((o) => o.value).filter((v) => v && v !== 'Others');
    setCustomFields({
      brand: Boolean(product.brand && !presetBrands.includes(product.brand)),
      productType: Boolean(product.productType && !presetTypes.includes(product.productType))
    });
    setPreview(formatMediaUrl(product.image, BASE_URL) || '');
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    if (!token) {
      showAppToast('请先登录', 'error');
      return;
    }

    try {
      const res = await safeFetch(`${API_PRODUCTS}/${deleteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      setProducts((prev) => prev.filter((p) => p.id !== deleteId));
      showAppToast('产品已删除', 'success');
      fetchProducts(activeSearch, page, pageSize);
    } catch (err) {
      console.error('删除失败:', err);
      showAppToast(`删除失败：${err.message}`, 'error');
    } finally {
      setShowDeleteDialog(false);
      setDeleteId(null);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteId(id);
    setShowDeleteDialog(true);
  };

  const relatedProductMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p?.id != null) map.set(p.id, p);
      ['compatibleProducts', 'upgradeProducts', 'mutualReplacementProducts', 'replacementProducts'].forEach((key) => {
        if (Array.isArray(p?.[key])) {
          p[key].forEach((rel) => {
            if (rel?.id != null && !map.has(rel.id)) {
              map.set(rel.id, rel);
            }
          });
        }
      });
    });
    return map;
  }, [products]);

  const getRelatedProducts = useCallback(
    (ids) => {
      if (!ids || !Array.isArray(ids)) return [];
      return ids.map((id) => relatedProductMap.get(id)).filter(Boolean);
    },
    [relatedProductMap]
  );

  const renderProductList = () => {
    if (loading) {
      return <CardGridSkeleton count={Math.min(pageSize, 6)} />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={() => fetchProducts(activeSearch, page, pageSize)} />;
    }

    if (products.length === 0) {
      return (
        <EmptyState
          title={searchTerm ? '未找到相关产品' : '暂无产品'}
          description={
            searchTerm
              ? `没有找到包含 "${searchTerm}" 的产品，请尝试其他关键词。`
              : '当前产品库还没有任何记录，点击下方按钮添加第一个产品。'
          }
          actionLabel={searchTerm ? '查看所有产品' : '添加第一个产品'}
          onAction={searchTerm ? clearSearch : toggleModal}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {products.map((product) => {
          const statusMeta = getStatusMeta(product.status);
          const compatibleCount = product.compatibleIds?.length || 0;
          const upgradeCount = product.upgradeIds?.length || 0;
          const mutualReplacementCount = product.mutualReplacementIds?.length || 0;
          const replacementCount = product.replacementIds?.length || 0;

          return (
            <article
              id={`product-${product.id}`}
              key={product.id}
              className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
            >
              {/* 上半部分：正方形图片 + 关键信息（与前台一致） */}
              <div className="flex flex-row border-b border-slate-100">
                <div className="w-36 sm:w-40 aspect-square shrink-0 bg-slate-50 border-r border-slate-100 overflow-hidden">
                  <MediaThumb
                    src={formatMediaUrl(product.image, BASE_URL)}
                    alt={product.model || '产品图片'}
                    className="w-full h-full aspect-square object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 p-3 sm:p-3.5 flex flex-col justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="text-[15px] font-semibold text-slate-900 truncate leading-snug"
                        title={product.model || ''}
                      >
                        <span className="font-normal text-slate-400 mr-1">Model:</span>
                        {product.model || '未命名型号'}
                      </h3>
                      <span className={`text-xs font-medium whitespace-nowrap shrink-0 ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 truncate">
                      <span className="font-mono tabular-nums" title={product.sku || ''}>
                        SKU: {product.sku || '—'}
                      </span>
                      <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
                      <span>{product.productType || '无类型'}</span>
                    </p>
                  </div>

                  {/* 在售链接、说明书、QA文档与NAS文档链接 */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    {product.httpLink ? (
                      <a
                        href={product.httpLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap"
                        title={product.httpLink}
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        在售链接
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1 text-slate-300 cursor-not-allowed select-none whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        在售链接
                      </span>
                    )}

                    {product.manual ? (
                      <a
                        href={formatMediaUrl(product.manual, BASE_URL)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        说明书
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1 text-slate-300 cursor-not-allowed select-none whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        说明书
                      </span>
                    )}

                    {product.qaDocument ? (
                      <a
                        href={formatMediaUrl(product.qaDocument, BASE_URL)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap"
                        title={product.qaDocument}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                        QA文档
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1 text-slate-300 cursor-not-allowed select-none whitespace-nowrap"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                        QA文档
                      </span>
                    )}

                    {product.nasLink ? (
                      /^https?:\/\//i.test(product.nasLink.trim()) ? (
                        <a
                          href={product.nasLink.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap"
                          title={product.nasLink}
                        >
                          <HardDrive className="w-3.5 h-3.5 shrink-0" />
                          NAS文档链接
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard?.writeText) {
                              navigator.clipboard.writeText(product.nasLink.trim())
                                .then(() => showAppToast('已复制 NAS 文档路径，请打开资源管理器粘贴', 'success'))
                                .catch(() => showAppToast(`NAS 路径：${product.nasLink.trim()}`, 'info'));
                            } else {
                              showAppToast(`NAS 路径：${product.nasLink.trim()}`, 'info');
                            }
                          }}
                          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap text-left"
                          title={`点击复制 NAS 路径：${product.nasLink}`}
                        >
                          <HardDrive className="w-3.5 h-3.5 shrink-0" />
                          NAS文档链接
                        </button>
                      )
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex items-center gap-1 text-slate-300 cursor-not-allowed select-none whitespace-nowrap"
                      >
                        <HardDrive className="w-3.5 h-3.5 shrink-0" />
                        NAS文档链接
                      </span>
                    )}
                  </div>

                  {/* 关联数量快捷查看 */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
                    <button
                      type="button"
                      onClick={() => {
                        if (compatibleCount > 0) openRelationModal(product, 'compatible');
                      }}
                      disabled={compatibleCount === 0}
                      className={`whitespace-nowrap transition-colors ${
                        compatibleCount > 0
                          ? 'text-emerald-700 hover:text-emerald-800 hover:underline font-medium'
                          : 'text-slate-400 cursor-default'
                      }`}
                    >
                      互匹配 {compatibleCount}
                    </button>
                    <span aria-hidden="true" className="text-slate-200">/</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (mutualReplacementCount > 0) openRelationModal(product, 'mutual_replacement');
                      }}
                      disabled={mutualReplacementCount === 0}
                      className={`whitespace-nowrap transition-colors ${
                        mutualReplacementCount > 0
                          ? 'text-sky-700 hover:text-sky-800 hover:underline font-medium'
                          : 'text-slate-400 cursor-default'
                      }`}
                    >
                      互替代 {mutualReplacementCount}
                    </button>
                    <span aria-hidden="true" className="text-slate-200">/</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (replacementCount > 0) openRelationModal(product, 'replacement');
                      }}
                      disabled={replacementCount === 0}
                      className={`whitespace-nowrap transition-colors ${
                        replacementCount > 0
                          ? 'text-amber-700 hover:text-amber-800 hover:underline font-medium'
                          : 'text-slate-400 cursor-default'
                      }`}
                    >
                      可替代 {replacementCount}
                    </button>
                    <span aria-hidden="true" className="text-slate-200">/</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (upgradeCount > 0) openRelationModal(product, 'upgrade');
                      }}
                      disabled={upgradeCount === 0}
                      className={`whitespace-nowrap transition-colors ${
                        upgradeCount > 0
                          ? 'text-indigo-600 hover:text-indigo-800 hover:underline font-medium'
                          : 'text-slate-400 cursor-default'
                      }`}
                    >
                      升级款 {upgradeCount}
                    </button>
                  </div>

                  {/* 开发原型 */}
                  <p
                    className="text-xs text-slate-600 truncate"
                    title={`开发原型：${[product.brand, product.productfccId].filter(Boolean).join(' ') || '—'}`}
                  >
                    <span className="text-slate-400">开发原型：</span>
                    {product.brand || product.productfccId ? (
                      <>
                        {product.brand && (
                          <span className="font-medium text-slate-700">{product.brand}</span>
                        )}
                        {product.brand && product.productfccId && ' '}
                        {product.productfccId && (
                          <span className="font-mono tabular-nums text-slate-700">
                            {product.productfccId}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </p>
                </div>
              </div>

              {/* 中间：描述 */}
              <div className="px-4 py-3 flex-1 bg-white">
                <p className="text-xs font-medium text-slate-400 mb-1">描述</p>
                <p
                  className="text-sm text-slate-600 line-clamp-2 leading-relaxed min-h-[2.625rem]"
                  title={product.description || ''}
                >
                  {product.description || '暂无描述'}
                </p>
              </div>

              {/* 底部管理操作栏：管理员 4 按钮，编辑员 3 按钮（无删除权限） */}
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 mt-auto">
                <div className={`grid ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5`}>
                  <button
                    type="button"
                    onClick={() => openDetailModal(product)}
                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    详情
                  </button>
                  <button
                    type="button"
                    onClick={() => openRelationsModal(product)}
                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors whitespace-nowrap"
                  >
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    关系
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(product)}
                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-50 transition-colors whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5 shrink-0" />
                    编辑
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(product.id)}
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-medium hover:bg-rose-50 transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      删除
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const subtitleText = activeSearch && !loading
    ? `搜索 "${activeSearch}" · 共 ${pagination.total} 个结果`
    : loading
      ? '正在同步产品列表...'
      : `共 ${pagination.total} 个产品`;

  return (
    <div>
      <PageToolbar
        title="产品信息管理"
        subtitle={subtitleText}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        searchPlaceholder="输入 SKU、Model 搜索..."
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
            添加产品
          </button>
        }
      />

      {renderProductList()}

      {!error && (
        <PaginationBar
          page={pagination.page}
          pageSize={pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          loading={loading}
          itemLabel="个产品"
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="删除产品"
        message="确定要删除该产品吗？此操作不可恢复。"
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteDialog(false);
          setDeleteId(null);
        }}
        isDanger={true}
      />

      {/* 新增/编辑产品模态框 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <h2 className="text-base font-semibold text-slate-900">
                {editingProduct ? '编辑产品' : '添加新产品'}
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
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      SKU <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="sku"
                      value={newProduct.sku || ''}
                      onChange={handleInputChange}
                      className={`w-full h-10 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                        formErrors.sku ? 'border-rose-400' : 'border-slate-200'
                      }`}
                      placeholder="请输入产品 SKU"
                    />
                    {formErrors.sku && <p className="text-rose-600 text-xs mt-1">{formErrors.sku}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Model <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="model"
                      value={newProduct.model || ''}
                      onChange={handleInputChange}
                      className={`w-full h-10 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                        formErrors.model ? 'border-rose-400' : 'border-slate-200'
                      }`}
                      placeholder="请输入产品 Model"
                    />
                    {formErrors.model && <p className="text-rose-600 text-xs mt-1">{formErrors.model}</p>}
                  </div>

                  {/* 开发原型（单独一行：品牌与型号（FCC ID）均选填） */}
                  <div className="md:col-span-2 p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg">
                    <label className="block text-xs font-semibold text-slate-700 mb-2.5">
                      开发原型
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          品牌 <span className="text-slate-400 font-normal">（选填）</span>
                        </label>
                        {!customFields.brand ? (
                          <select
                            name="brand"
                            value={newProduct.brand || ''}
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
                              value={newProduct.brand || ''}
                              onChange={handleInputChange}
                              autoFocus
                              className={`w-full h-10 px-3 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                                formErrors.brand ? 'border-rose-400' : 'border-slate-200'
                              }`}
                              placeholder="请输入自定义品牌"
                            />
                            <button
                              type="button"
                              onClick={() => cancelCustomField('brand')}
                              title="返回下拉选择"
                              aria-label="返回品牌下拉选择"
                              className="h-10 w-10 inline-flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {formErrors.brand && (
                          <p className="text-rose-600 text-xs mt-1">{formErrors.brand}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          型号（FCC ID） <span className="text-slate-400 font-normal">（选填）</span>
                        </label>
                        <input
                          type="text"
                          name="productfccId"
                          value={newProduct.productfccId || ''}
                          onChange={handleInputChange}
                          className={`w-full h-10 px-3 text-sm font-mono bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                            formErrors.productfccId ? 'border-rose-400' : 'border-slate-200'
                          }`}
                          placeholder="请输入型号（FCC ID，选填）"
                        />
                        {formErrors.productfccId && (
                          <p className="text-rose-600 text-xs mt-1">{formErrors.productfccId}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      产品类型 <span className="text-rose-500">*</span>
                    </label>
                    {!customFields.productType ? (
                      <select
                        name="productType"
                        value={newProduct.productType || ''}
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
                          value={newProduct.productType || ''}
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
                          aria-label="返回产品类型下拉选择"
                          className="h-10 w-10 inline-flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {formErrors.productType && (
                      <p className="text-rose-600 text-xs mt-1">{formErrors.productType}</p>
                    )}
                  </div>

                  {/* 销售状态（下拉框：在售 / 清仓 / 开发中 / 停产） */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      销售状态 <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="status"
                      value={newProduct.status || 'active'}
                      onChange={handleInputChange}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      产品在售链接
                    </label>
                    <input
                      type="url"
                      name="httpLink"
                      value={newProduct.httpLink || ''}
                      onChange={handleInputChange}
                      className={`w-full h-10 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                        formErrors.httpLink ? 'border-rose-400' : 'border-slate-200'
                      }`}
                      placeholder="https://example.com/product（可选）"
                    />
                    {formErrors.httpLink && (
                      <p className="text-rose-600 text-xs mt-1">{formErrors.httpLink}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      NAS 文档链接
                    </label>
                    <input
                      type="text"
                      name="nasLink"
                      value={newProduct.nasLink || ''}
                      onChange={handleInputChange}
                      className={`w-full h-10 px-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                        formErrors.nasLink ? 'border-rose-400' : 'border-slate-200'
                      }`}
                      placeholder="https://nas.example.com/... 或 \\\\192.168.1.10\\docs（可选）"
                    />
                    {formErrors.nasLink && (
                      <p className="text-rose-600 text-xs mt-1">{formErrors.nasLink}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">描述</label>
                  <textarea
                    name="description"
                    value={newProduct.description || ''}
                    onChange={handleInputChange}
                    rows="3"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                      formErrors.description ? 'border-rose-400' : 'border-slate-200'
                    }`}
                    placeholder="请输入产品详细描述..."
                  />
                  {formErrors.description && (
                    <p className="text-rose-600 text-xs mt-1">{formErrors.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                  {/* 产品图片 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">产品图片</label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap">
                          <Upload className="w-3.5 h-3.5" />
                          <span>选择图片</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            id="image-upload"
                          />
                        </label>
                        <span className="text-xs text-slate-400">JPG/PNG/WebP，≤ 5MB</span>
                      </div>
                      {preview && (
                        <div className="relative w-32 h-32 aspect-square border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <MediaThumb src={preview} alt="产品图片预览" />
                          <button
                            type="button"
                            onClick={() => {
                              setPreview('');
                              setImageFile(null);
                              setNewProduct((prev) => ({ ...prev, image: null, _hasImage: false }));
                              const inputEl = document.getElementById('image-upload');
                              if (inputEl) inputEl.value = '';
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

                  {/* PDF 说明书 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">PDF 说明书</label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap">
                          <FileText className="w-3.5 h-3.5" />
                          <span>选择 PDF</span>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handlePdfChange}
                            className="hidden"
                            id="pdf-upload"
                          />
                        </label>
                        <span className="text-xs text-slate-400">PDF 格式，≤ 10MB</span>
                      </div>

                      {pdfFile && (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{pdfFile.name}</p>
                            <p className="text-[11px] text-slate-400 tabular-nums">
                              {(pdfFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPdfFile(null);
                              const inputEl = document.getElementById('pdf-upload');
                              if (inputEl) inputEl.value = '';
                            }}
                            aria-label="移除文件"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {!pdfFile && newProduct.manual && (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <a
                            href={formatMediaUrl(newProduct.manual, BASE_URL)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline truncate"
                          >
                            {newProduct.manual}
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setPdfFile(null);
                              setNewProduct((prev) => ({ ...prev, manual: null, _hasManual: false }));
                              const inputEl = document.getElementById('pdf-upload');
                              if (inputEl) inputEl.value = '';
                            }}
                            aria-label="移除说明书"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QA 文档（PDF / DOC / DOCX / XLS / XLSX） */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">QA 文档</label>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>选择 QA 文档</span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            onChange={handleQaDocChange}
                            className="hidden"
                            id="qa-doc-upload"
                          />
                        </label>
                        <span className="text-xs text-slate-400">支持 PDF、DOC、DOCX、XLS、XLSX，≤ 10MB</span>
                      </div>

                      {qaFile && (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{qaFile.name}</p>
                            <p className="text-[11px] text-slate-400 tabular-nums">
                              {(qaFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setQaFile(null);
                              const inputEl = document.getElementById('qa-doc-upload');
                              if (inputEl) inputEl.value = '';
                            }}
                            aria-label="移除 QA 文档"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {!qaFile && newProduct.qaDocument && (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <a
                            href={formatMediaUrl(newProduct.qaDocument, BASE_URL)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline truncate"
                          >
                            {newProduct.qaDocument}
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setQaFile(null);
                              setNewProduct((prev) => ({ ...prev, qaDocument: null, _hasQaDocument: false }));
                              const inputEl = document.getElementById('qa-doc-upload');
                              if (inputEl) inputEl.value = '';
                            }}
                            aria-label="移除 QA 文档"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
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
                  {isSubmitting ? '提交中...' : editingProduct ? '保存修改' : '添加产品'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 产品关系管理模态框 */}
      {showRelationsModal && selectedProductForRelations && (
        <ProductRelationsManager
          product={selectedProductForRelations}
          onClose={closeRelationsModal}
          onSave={() => {
            fetchProducts(activeSearch, page, pageSize);
          }}
          apiUrl="/api/products"
        />
      )}

      {/* 可匹配/升级/替换查看模态框 */}
      <ProductRelationModal
        isOpen={relationModalState.isOpen}
        onClose={closeRelationModal}
        product={relationModalState.product}
        initialTab={relationModalState.initialTab}
        getRelatedProducts={getRelatedProducts}
        baseUrl={BASE_URL}
        onSelectProduct={(p, label) => {
          closeRelationModal();
          const target = document.getElementById(`product-${p.id}`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('ring-2', 'ring-indigo-500');
            setTimeout(() => target.classList.remove('ring-2', 'ring-indigo-500'), 2000);
          } else {
            openDetailModal(p, label);
          }
        }}
      />

      {/* 产品详情模态框（与前台一致） */}
      {detailModalStack.map((entry, idx) => (
        <ProductDetailModal
          key={`${entry.product.id}-${idx}`}
          product={entry.product}
          relationLabel={entry.relationLabel}
          depth={idx}
          isTopmost={idx === detailModalStack.length - 1}
          onClose={closeTopDetailModal}
          getRelatedProducts={getRelatedProducts}
          baseUrl={BASE_URL}
        />
      ))}
    </div>
  );
}
