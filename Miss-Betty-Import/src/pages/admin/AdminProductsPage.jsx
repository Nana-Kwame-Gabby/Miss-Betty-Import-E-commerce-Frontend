import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const EMPTY_FORM = {
  product_name: "",
  category_id: "",
  unit_price: "",
  status_id: "",
  description: "",
  sizes: "",
  colours: "",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoadingProducts(true);
    const [{ data: prods }, { data: cats }, { data: stats }] = await Promise.all([
      supabase.from('products')
        .select('*, category(category_name), product_status(status_name)')
        .order('product_id', { ascending: false }),
      supabase.from('category').select('*').order('category_name'),
      supabase.from('product_status').select('*'),
    ]);
    setProducts(prods ?? []);
    setCategories(cats ?? []);
    setStatuses(stats ?? []);
    setLoadingProducts(false);
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.product_name.trim() || !form.category_id || !form.unit_price || !form.status_id) {
      setError("Product name, category, price, and status are required.");
      return;
    }

    setSubmitting(true);

    // Upload image to Supabase Storage if one was selected
    let imageUrl = null;
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, imageFile);
      if (uploadError) {
        setError(uploadError.message);
        setSubmitting(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(path);
      imageUrl = publicUrl;
    }

    const { error: insertError } = await supabase.from('products').insert({
      product_name: form.product_name.trim(),
      category_id: Number(form.category_id),
      unit_price: Number(form.unit_price),
      product_status_id: Number(form.status_id),
      description: form.description.trim() || null,
      product_image_url: imageUrl,
      size: form.sizes.trim() || null,
      colour: form.colours.trim() || null,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess("Product uploaded successfully!");
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    loadAll();
    setTimeout(() => setSuccess(""), 4000);
  }

  async function handleDelete(productId) {
    if (!confirm("Delete this product?")) return;
    setDeletingId(productId);
    await supabase.from('products').delete().eq('product_id', productId);
    setDeletingId(null);
    loadAll();
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F2AA25]";
  const labelClass = "block text-xs font-semibold text-[#1e2d3d] mb-1";

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Products</h1>
      <p className="text-sm text-gray-400 mb-6">Upload and manage store products</p>

      {/* Upload Form */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-8">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-4">Upload New Product</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Product Name */}
          <div className="sm:col-span-2">
            <label className={labelClass}>Product Name *</label>
            <input name="product_name" value={form.product_name} onChange={handleChange} placeholder="e.g. Baby Stroller Deluxe" className={inputClass} />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Category *</label>
            <select name="category_id" value={form.category_id} onChange={handleChange} className={inputClass}>
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className={labelClass}>Status *</label>
            <select name="status_id" value={form.status_id} onChange={handleChange} className={inputClass}>
              <option value="">Select status</option>
              {statuses.map(s => (
                <option key={s.product_status_id} value={s.product_status_id}>{s.status_name}</option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div>
            <label className={labelClass}>Unit Price (GHS) *</label>
            <input name="unit_price" type="number" min="0" step="0.01" value={form.unit_price} onChange={handleChange} placeholder="0.00" className={inputClass} />
          </div>

          {/* Image Upload */}
          <div>
            <label className={labelClass}>Product Image</label>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <span className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-[#1e2d3d] font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                {imageFile ? imageFile.name : 'Choose Image'}
              </span>
            </label>
            {imagePreview && (
              <div className="mt-2 relative w-fit">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Sizes */}
          <div>
            <label className={labelClass}>Sizes <span className="text-gray-400 font-normal">(comma-separated, optional)</span></label>
            <input name="sizes" value={form.sizes} onChange={handleChange} placeholder="S,M,L,XL or King,Queen" className={inputClass} />
          </div>

          {/* Colours */}
          <div>
            <label className={labelClass}>Colours <span className="text-gray-400 font-normal">(comma-separated, optional)</span></label>
            <input name="colours" value={form.colours} onChange={handleChange} placeholder="Red,Blue,White" className={inputClass} />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Product description…" className={`${inputClass} resize-none`} />
          </div>

          {error && (
            <p className="sm:col-span-2 text-red-500 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="sm:col-span-2 text-green-600 text-xs bg-green-50 border border-green-100 rounded-xl px-3 py-2">{success}</p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#F2AA25] text-white font-bold text-sm px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Uploading…
                </>
              ) : "Upload Product"}
            </button>
          </div>
        </form>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#1e2d3d]">All Products ({products.length})</h2>
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No products yet. Upload one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.product_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {p.product_image_url ? (
                          <img src={p.product_image_url} alt={p.product_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          </div>
                        )}
                        <span className="font-semibold text-[#1e2d3d] line-clamp-1">{p.product_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.category?.category_name ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-[#F2AA25]">GHS {Number(p.unit_price).toLocaleString()}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.product_status?.status_name === 'Available'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {p.product_status?.status_name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(p.product_id)}
                        disabled={deletingId === p.product_id}
                        className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingId === p.product_id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
