"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteAdminProduct,
  fetchAdminProducts,
  updateAdminProduct,
  type AdminProduct,
} from "@/lib/admin/products";
import { ADMIN_REALTIME_TABLES } from "@/lib/admin/realtime";
import { useAdminRealtimeQuery } from "@/hooks/useAdminRealtimeQuery";

type Product = AdminProduct & { stock?: number };

export default function AdminProductsPage() {
  const productTables = useMemo(
    () => [...ADMIN_REALTIME_TABLES.products],
    []
  );
  const { data, loading, setData } = useAdminRealtimeQuery<Product[]>({
    channel: "products",
    tables: productTables,
    fetcher: async () => {
      const items = await fetchAdminProducts();
      return items.map((p) => ({
        ...p,
        stock: p.totalStock ?? 0,
      }));
    },
  });
  const products = data ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditValues({
      name: product.name,
      price: product.price,
      stock: product.stock,
      sizes: product.sizes ? product.sizes.map(s => ({ ...s })) : undefined,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const isEditValid = () => {
    if (!editValues.sizes || editValues.sizes.length === 0) return false;
    for (const s of editValues.sizes) {
      if (!s.size || Number(s.stock) <= 0 || isNaN(Number(s.stock))) return false;
    }
    return true;
  };

  const saveEdit = async (id: string) => {
    if (!isEditValid()) {
      alert('Please select a size and enter stock for all sizes.');
      return;
    }
    setSaving(true);
    await updateAdminProduct(id, {
      name: editValues.name,
      price: Number(editValues.price),
      sizes: editValues.sizes?.map((s) => ({
        size: s.size,
        stock: Number(s.stock),
      })),
    });
    const totalStock = editValues.sizes
      ? editValues.sizes.reduce((sum, s) => sum + Number(s.stock), 0)
      : undefined;
    setData((prev) =>
      (prev ?? []).map((p) =>
        p.id === id
          ? {
              ...p,
              ...editValues,
              price: Number(editValues.price),
              stock: totalStock ?? p.stock,
              sizes: editValues.sizes?.map((s) => ({
                ...s,
                stock: Number(s.stock),
              })),
              totalStock,
            }
          : p
      )
    );
    setEditingId(null);
    setEditValues({});
    setSaving(false);
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    await deleteAdminProduct(id);
    setData((prev) => (prev ?? []).filter((p) => p.id !== id));
  };

  const toggleFeatured = async (id: string, value: boolean) => {
    await updateAdminProduct(id, { isFeaturedProduct: value });
    setData((prev) =>
      (prev ?? []).map((p) =>
        p.id === id ? { ...p, isFeaturedProduct: value } : p
      )
    );
  };

  if (loading) return <div className="p-8 text-[#8ec0ff]">Loading products...</div>;

  return (
    <div className="w-full pb-8">
        <h1 className="text-3xl font-bold mb-8 text-[#3390ff]">Manage Products</h1>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-[#161e2e] border border-[#22304a] rounded-lg text-white">
            <thead>
              <tr className="bg-[#22304a] text-[#8ec0ff]">
                <th className="p-3 border-b border-[#22304a] text-center text-sm px-2 py-2">Image</th>
                <th className="p-3 border-b border-[#22304a] text-left text-sm px-2 py-2">Name</th>
                <th className="p-3 border-b border-[#22304a] text-left text-sm px-2 py-2">Brand</th>
                <th className="p-3 border-b border-[#22304a] text-left text-sm px-2 py-2">Price</th>
                <th className="p-3 border-b border-[#22304a] text-left text-sm px-2 py-2">Stock</th>
                <th className="p-3 border-b border-[#22304a] text-center text-sm px-2 py-2">Featured</th>
                <th className="p-3 border-b border-[#22304a] text-center text-sm px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-[#22304a] hover:bg-[#1e293b] transition-colors">
                  <td className="px-4 py-2 text-center text-sm px-2 py-1">
                    <img
                      src={Array.isArray(product.imageUrls) && product.imageUrls.length > 0 ? product.imageUrls[0] : '/images/placeholder.jpg'}
                      alt={product.name}
                      className="w-12 h-12 object-contain rounded bg-[#22304a]"
                    />
                  </td>
                  <td className="p-3 text-sm px-2 py-1">
                    {editingId === product.id ? (
                      <input
                        className="bg-[#22304a] border border-[#22304a] px-2 py-1 rounded w-32 text-white text-xs px-1 py-1 h-7 w-20 sm:w-auto"
                        value={editValues.name || ""}
                        onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))}
                      />
                    ) : (
                      <span className="font-semibold text-white">{product.name}</span>
                    )}
                  </td>
                  <td className="p-3 text-[#8ec0ff] text-sm px-2 py-1">{product.brand || "-"}</td>
                  <td className="p-3 text-sm px-2 py-1">
                    {editingId === product.id ? (
                      <input
                        type="number"
                        className="bg-[#22304a] border border-[#22304a] px-2 py-1 rounded w-20 text-white text-xs px-1 py-1 h-7 w-20 sm:w-auto"
                        value={editValues.price ?? ""}
                        onChange={e => setEditValues(v => ({ ...v, price: Number(e.target.value) }))}
                      />
                    ) : (
                      <span className="font-semibold text-[#3390ff]">₱{product.price}</span>
                    )}
                  </td>
                  <td className="p-3 text-sm px-2 py-1">
                    {editingId === product.id ? (
                      editValues.sizes && editValues.sizes.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {(editValues.sizes || []).map((s, i) => {
                            const selectedSizes = (editValues.sizes || []).map((sz, idx) => idx !== i ? sz.size : null).filter(Boolean);
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <select
                                  className="bg-[#22304a] border border-[#22304a] px-2 py-1 rounded w-24 text-xs font-semibold text-center text-white text-xs px-1 py-1 h-7 w-20 sm:w-auto"
                                  value={s.size}
                                  onChange={e => {
                                    const newSizes = [...(editValues.sizes || [])];
                                    newSizes[i].size = e.target.value;
                                    setEditValues(v => ({ ...v, sizes: newSizes }));
                                  }}
                                  required
                                >
                                  <option value="">Select size</option>
                                  {['S', 'M', 'L', 'XL', '2XL'].map(opt => (
                                    selectedSizes.includes(opt)
                                      ? <option key={opt} value={opt} disabled>{opt}</option>
                                      : <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  className="bg-[#22304a] border border-[#22304a] px-2 py-1 rounded w-24 text-xs text-white text-xs px-1 py-1 h-7 w-20 sm:w-auto"
                                  value={s.stock === 0 ? '' : s.stock}
                                  min={0}
                                  placeholder="Stock"
                                  onChange={e => {
                                    let val = e.target.value.replace(/^0+(?!$)/, '');
                                    if (val === '') val = '0';
                                    const newSizes = [...(editValues.sizes || [])];
                                    newSizes[i].stock = Number(val);
                                    setEditValues(v => ({ ...v, sizes: newSizes }));
                                  }}
                                />
                                <button
                                  type="button"
                                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                  onClick={() => {
                                    const newSizes = [...(editValues.sizes || [])];
                                    newSizes.splice(i, 1);
                                    setEditValues(v => ({ ...v, sizes: newSizes }));
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(product.sizes || []).map((s, i) => (
                          <span key={i} className="bg-[#22304a] text-[#60A5FA] px-2 py-1 rounded text-xs font-semibold">{s.size}: {s.stock}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center text-sm px-2 py-1">
                    <input
                      type="checkbox"
                      checked={!!product.isFeaturedProduct}
                      onChange={e => toggleFeatured(product.id, e.target.checked)}
                      className="accent-[#3390ff] w-4 h-4"
                    />
                  </td>
                  <td className="p-3 text-sm px-2 py-1">
                    {editingId === product.id ? (
                      <>
                        <Button
                          className="mr-2 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => saveEdit(product.id)}
                          disabled={saving || !isEditValid()}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          className="border border-[#22304a] text-[#8ec0ff] hover:bg-[#22304a]"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <div className="flex flex-row gap-2 justify-center items-center">
                        <Button
                          className="text-xs px-1 py-1 h-7 min-w-[36px] sm:text-sm sm:px-2 sm:py-1 sm:h-8 sm:min-w-[48px] bg-yellow-500 hover:bg-yellow-600 text-white"
                          onClick={() => startEdit(product)}
                        >
                          Edit
                        </Button>
                        <Button
                          className="text-xs px-1 py-1 h-7 min-w-[36px] sm:text-sm sm:px-2 sm:py-1 sm:h-8 sm:min-w-[48px] bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => deleteProduct(product.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
} 