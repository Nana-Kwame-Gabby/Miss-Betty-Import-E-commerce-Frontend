import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const EMPTY_FORM = {
  product_name: "",
  category_id: "",
  cost_price: "",
  profit: "",
  discount_price: "",
  status_id: "",
  description: "",
  sizes: "",
  colours: "",
  estimated_shipping_fee: "",
};

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>
);

function ImagePickerField({ label, file, preview, onChange, onClear, existingUrl = null }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">{label}</label>
      <div className="flex items-start gap-3">
        {(preview || existingUrl) && (
          <div className="relative flex-shrink-0">
            <img
              src={preview ?? existingUrl}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-xl border border-gray-200"
            />
            {preview && (
              <button
                type="button"
                onClick={onClear}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
              >×</button>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="file" accept="image/*" onChange={onChange} className="hidden" />
          <span className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-[#1e2d3d] font-semibold text-xs px-3 py-2 rounded-xl transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            {file ? file.name : existingUrl ? "Replace Image" : "Choose Image"}
          </span>
        </label>
      </div>
    </div>
  );
}


function getStoragePath(publicUrl, bucket) {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

async function uploadFile(file, folder = "", bucket = "product-images") {
  const ext = file.name.split(".").pop();
  const path = `${folder}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);

  // Upload form
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile2, setImageFile2]   = useState(null);
  const [imagePreview2, setImagePreview2] = useState(null);
  const [tiktokUrl, setTiktokUrl]     = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const [useSizePricing, setUseSizePricing] = useState(false);
  const [sizePricingRows, setSizePricingRows] = useState([{ size: "", cost_price: "", profit: "", discount_price: "" }]);

  // Edit modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm]             = useState(EMPTY_FORM);
  const [editImageFile, setEditImageFile]   = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [editImageFile2, setEditImageFile2] = useState(null);
  const [editImagePreview2, setEditImagePreview2] = useState(null);
  const [editTiktokUrl, setEditTiktokUrl]   = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError]           = useState("");
  const [editUseSizePricing, setEditUseSizePricing] = useState(false);
  const [editSizePricingRows, setEditSizePricingRows] = useState([{ size: "", cost_price: "", profit: "", discount_price: "" }]);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [deletingId, setDeletingId]           = useState(null);

  // Filter/search
  const [productSearch,  setProductSearch]  = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoadingProducts(true);
    const [{ data: prods }, { data: cats }, { data: stats }] = await Promise.all([
      supabase.from("products")
        .select("*, category(category_name), product_status(status_name)")
        .order("product_id", { ascending: false }),
      supabase.from("category").select("*").order("category_name"),
      supabase.from("product_status").select("*"),
    ]);
    setProducts(prods ?? []);
    setCategories(cats ?? []);
    setStatuses(stats ?? []);
    setLoadingProducts(false);
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function makeImagePicker(setFile, setPreview) {
    return (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setFile(file);
      setPreview(URL.createObjectURL(file));
    };
  }


  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.product_name.trim() || !form.category_id || (!useSizePricing && !form.cost_price) || !form.status_id) {
      setError("Product name, category, cost price, and status are required.");
      return;
    }
    const validRows = sizePricingRows.filter(r => r.size.trim() && r.cost_price !== "" && r.profit !== "");
    if (useSizePricing && validRows.length === 0) {
      setError("Add at least one complete size entry, or disable size-based pricing.");
      return;
    }

    setSubmitting(true);
    try {
      const [imageUrl, imageUrl2] = await Promise.all([
        imageFile  ? uploadFile(imageFile,  "images/", "product-images") : Promise.resolve(null),
        imageFile2 ? uploadFile(imageFile2, "images/", "product-images") : Promise.resolve(null),
      ]);
      const videoUrl = tiktokUrl.trim() || null;

      const cost_price = Number(form.cost_price);
      const profit     = Number(form.profit || 0);

      const size_pricing = useSizePricing && validRows.length > 0
        ? validRows.map(r => {
            const sp = Number(r.cost_price) + Number(r.profit);
            const dp = r.discount_price !== "" && Number(r.discount_price) > 0 && Number(r.discount_price) < sp
              ? Number(r.discount_price) : null;
            return { size: r.size.trim(), cost_price: Number(r.cost_price), profit: Number(r.profit), selling_price: sp, discount_price: dp };
          })
        : null;
      const unit_price = size_pricing
        ? Math.min(...size_pricing.map(r => r.selling_price))
        : cost_price + profit;
      const sizeValue = size_pricing
        ? size_pricing.map(r => r.size).join(',')
        : (form.sizes.trim() || null);
      const simpleDiscountPrice = !useSizePricing && form.discount_price !== "" && Number(form.discount_price) > 0 && Number(form.discount_price) < unit_price
        ? Number(form.discount_price) : null;

      const { error: insertError } = await supabase.from("products").insert({
        product_name: form.product_name.trim(),
        category_id: Number(form.category_id),
        cost_price,
        profit,
        unit_price,
        discount_price: simpleDiscountPrice,
        product_status_id: Number(form.status_id),
        description: form.description.trim() || null,
        product_image_url:   imageUrl,
        product_image_url_2: imageUrl2,
        product_video_url:   videoUrl,
        size:   sizeValue,
        colour: form.colours.trim() || null,
        size_pricing,
        estimated_shipping_fee: form.estimated_shipping_fee ? Number(form.estimated_shipping_fee) : null,
      });

      if (insertError) throw new Error(insertError.message);

      setSuccess("Product uploaded successfully!");
      setForm(EMPTY_FORM);
      setImageFile(null);    setImagePreview(null);
      setImageFile2(null);   setImagePreview2(null);
      setTiktokUrl("");
      setUseSizePricing(false);
      setSizePricingRows([{ size: "", cost_price: "", profit: "", discount_price: "" }]);
      loadAll();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  }

  async function handleDelete(product) {
    if (!confirm(`Delete "${product.product_name}"? This cannot be undone.`)) return;
    setDeletingId(product.product_id);
    try {
      const { error: ordersErr } = await supabase
        .from('orders')
        .update({ product_id: null })
        .eq('product_id', product.product_id);
      if (ordersErr) throw new Error(ordersErr.message);

      const { error: deleteErr } = await supabase
        .from('products')
        .delete()
        .eq('product_id', product.product_id);
      if (deleteErr) throw new Error(deleteErr.message);

      const imgPaths = [
        getStoragePath(product.product_image_url,   'product-images'),
        getStoragePath(product.product_image_url_2, 'product-images'),
      ].filter(Boolean);
      if (imgPaths.length) {
        await supabase.storage.from('product-images').remove(imgPaths);
      }
      const videoPath = getStoragePath(product.product_video_url, 'product-videos');
      if (videoPath) {
        await supabase.storage.from('product-videos').remove([videoPath]);
      }

      loadAll();
    } catch (err) {
      alert(`Could not delete product: ${err.message}`);
    }
    setDeletingId(null);
  }

  // ── Edit modal ────────────────────────────────────────────────────
  function handleEditOpen(product) {
    setEditingProduct(product);
    setEditForm({
      product_name:   product.product_name ?? "",
      category_id:    String(product.category_id ?? ""),
      cost_price:     String(product.cost_price ?? ""),
      profit:         String(product.profit ?? ""),
      discount_price: product.discount_price != null ? String(product.discount_price) : "",
      status_id:      String(product.product_status_id ?? ""),
      description:    product.description ?? "",
      sizes:          product.size ?? "",
      colours:        product.colour ?? "",
      estimated_shipping_fee: String(product.estimated_shipping_fee ?? ""),
    });
    setEditImageFile(null);    setEditImagePreview(null);
    setEditImageFile2(null);   setEditImagePreview2(null);
    setEditTiktokUrl(product.product_video_url ?? "");
    setEditError("");
    const sp = product.size_pricing;
    if (sp && sp.length > 0) {
      setEditUseSizePricing(true);
      setEditSizePricingRows(sp.map(r => ({
        size:          r.size,
        cost_price:    String(r.cost_price    ?? ""),
        profit:        String(r.profit        ?? ""),
        discount_price: r.discount_price != null ? String(r.discount_price) : "",
      })));
    } else {
      setEditUseSizePricing(false);
      setEditSizePricingRows([{ size: "", cost_price: "", profit: "", discount_price: "" }]);
    }
  }

  function handleEditClose() {
    setEditingProduct(null);
    setEditImageFile(null);    setEditImagePreview(null);
    setEditImageFile2(null);   setEditImagePreview2(null);
    setEditTiktokUrl("");
    setEditError("");
    setEditUseSizePricing(false);
    setEditSizePricingRows([{ size: "", cost_price: "", profit: "", discount_price: "" }]);
  }

  function handleEditChange(e) {
    setEditForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError("");
    if (!editForm.product_name.trim() || !editForm.category_id || (!editUseSizePricing && !editForm.cost_price) || !editForm.status_id) {
      setEditError("Product name, category, cost price, and status are required.");
      return;
    }
    const validEditRows = editSizePricingRows.filter(r => r.size.trim() && r.cost_price !== "" && r.profit !== "");
    if (editUseSizePricing && validEditRows.length === 0) {
      setEditError("Add at least one complete size entry, or disable size-based pricing.");
      return;
    }

    setEditSubmitting(true);
    try {
      const [imageUrl, imageUrl2] = await Promise.all([
        editImageFile  ? uploadFile(editImageFile,  "images/", "product-images") : Promise.resolve(editingProduct.product_image_url),
        editImageFile2 ? uploadFile(editImageFile2, "images/", "product-images") : Promise.resolve(editingProduct.product_image_url_2),
      ]);
      const videoUrl = editTiktokUrl.trim() || editingProduct.product_video_url || null;

      const cost_price = Number(editForm.cost_price);
      const profit     = Number(editForm.profit || 0);

      const size_pricing = editUseSizePricing && validEditRows.length > 0
        ? validEditRows.map(r => {
            const sp = Number(r.cost_price) + Number(r.profit);
            const dp = r.discount_price !== "" && Number(r.discount_price) > 0 && Number(r.discount_price) < sp
              ? Number(r.discount_price) : null;
            return { size: r.size.trim(), cost_price: Number(r.cost_price), profit: Number(r.profit), selling_price: sp, discount_price: dp };
          })
        : null;
      const unit_price = size_pricing
        ? Math.min(...size_pricing.map(r => r.selling_price))
        : cost_price + profit;
      const sizeValue = size_pricing
        ? size_pricing.map(r => r.size).join(',')
        : (editForm.sizes.trim() || null);
      const simpleDiscountPrice = !editUseSizePricing && editForm.discount_price !== "" && Number(editForm.discount_price) > 0 && Number(editForm.discount_price) < unit_price
        ? Number(editForm.discount_price) : null;

      const { error: updateError } = await supabase.from("products")
        .update({
          product_name: editForm.product_name.trim(),
          category_id: Number(editForm.category_id),
          cost_price,
          profit,
          unit_price,
          discount_price: editUseSizePricing ? null : simpleDiscountPrice,
          product_status_id: Number(editForm.status_id),
          description: editForm.description.trim() || null,
          product_image_url:   imageUrl,
          product_image_url_2: imageUrl2,
          product_video_url:   videoUrl,
          size:   sizeValue,
          colour: editForm.colours.trim() || null,
          size_pricing,
          estimated_shipping_fee: editForm.estimated_shipping_fee ? Number(editForm.estimated_shipping_fee) : null,
        })
        .eq("product_id", editingProduct.product_id);

      if (updateError) throw new Error(updateError.message);
      handleEditClose();
      loadAll();
    } catch (err) {
      setEditError(err.message);
    }
    setEditSubmitting(false);
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F2AA25]";
  const labelClass = "block text-xs font-semibold text-[#1e2d3d] mb-1";

  const filteredProducts = products.filter(p => {
    const matchesSearch   = p.product_name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = !categoryFilter || String(p.category_id) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Products</h1>
      <p className="text-sm text-gray-400 mb-6">Upload and manage store products</p>

      {/* ── Upload Form ── */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-8">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-4">Upload New Product</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Product Name *</label>
            <input name="product_name" value={form.product_name} onChange={handleChange} placeholder="e.g. Baby Stroller Deluxe" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Category *</label>
            <select name="category_id" value={form.category_id} onChange={handleChange} className={inputClass}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Status *</label>
            <select name="status_id" value={form.status_id} onChange={handleChange} className={inputClass}>
              <option value="">Select status</option>
              {statuses.map(s => <option key={s.product_status_id} value={s.product_status_id}>{s.status_name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Cost Price (GHS){useSizePricing ? " (optional)" : " *"}</label>
            <input name="cost_price" type="number" min="0" step="0.01" value={form.cost_price} onChange={handleChange} placeholder="0.00" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Profit (GHS)</label>
            <input name="profit" type="number" min="0" step="0.01" value={form.profit} onChange={handleChange} placeholder="0.00" className={inputClass} />
          </div>

          {!useSizePricing && (form.cost_price || form.profit) && (
            <div className="sm:col-span-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5">
              Final Price (shown to customers):{" "}
              <span className="font-bold text-[#1e2d3d]">
                GHS {(Number(form.cost_price || 0) + Number(form.profit || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {form.discount_price && Number(form.discount_price) > 0 && Number(form.discount_price) < (Number(form.cost_price || 0) + Number(form.profit || 0)) && (
                <span className="ml-2 text-red-600 font-bold">→ Discounted: GHS {Number(form.discount_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              )}
            </div>
          )}

          {!useSizePricing && (
            <div>
              <label className={labelClass}>Discounted Price (GHS) <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                name="discount_price"
                type="number"
                min="0"
                step="0.01"
                value={form.discount_price}
                onChange={handleChange}
                placeholder="Leave blank for no discount"
                className={inputClass}
              />
              <p className="text-[10px] text-gray-400 mt-1">Must be less than selling price to apply.</p>
            </div>
          )}

          {/* Media uploads */}
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-[#1e2d3d] mb-3 uppercase tracking-wide">Product Media</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ImagePickerField
                label="Image 1 (Main)"
                file={imageFile}
                preview={imagePreview}
                onChange={makeImagePicker(setImageFile, setImagePreview)}
                onClear={() => { setImageFile(null); setImagePreview(null); }}
              />
              <ImagePickerField
                label="Image 2"
                file={imageFile2}
                preview={imagePreview2}
                onChange={makeImagePicker(setImageFile2, setImagePreview2)}
                onClear={() => { setImageFile2(null); setImagePreview2(null); }}
              />
              <div>
                <label className={labelClass}>TikTok Video Link <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={e => setTiktokUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@user/video/..."
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Media will display as a slideshow: Image 1 → Image 2 → TikTok link</p>
          </div>

          {/* Sizes / Size-based pricing */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2.5 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={useSizePricing}
                onChange={e => setUseSizePricing(e.target.checked)}
                className="w-4 h-4 accent-[#F2AA25]"
              />
              <span className="text-xs font-semibold text-[#1e2d3d]">
                Enable size-based pricing <span className="text-gray-400 font-normal">(different price per size)</span>
              </span>
            </label>

            {useSizePricing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-gray-400 px-1">
                  <span>Size Name</span>
                  <span>Cost Price (GHS)</span>
                  <span>Profit (GHS)</span>
                  <span>Selling Price</span>
                  <span>Discount (opt.)</span>
                  <span />
                </div>
                {sizePricingRows.map((row, i) => {
                  const selling = (Number(row.cost_price) || 0) + (Number(row.profit) || 0);
                  return (
                    <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                      <input
                        value={row.size}
                        onChange={e => setSizePricingRows(prev => prev.map((r, j) => j === i ? { ...r, size: e.target.value } : r))}
                        placeholder="e.g. Small"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.cost_price}
                        onChange={e => setSizePricingRows(prev => prev.map((r, j) => j === i ? { ...r, cost_price: e.target.value } : r))}
                        placeholder="0.00"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.profit}
                        onChange={e => setSizePricingRows(prev => prev.map((r, j) => j === i ? { ...r, profit: e.target.value } : r))}
                        placeholder="0.00"
                        className={inputClass}
                      />
                      <div className="border border-gray-100 bg-gray-50 rounded-xl px-3 py-2 text-xs font-semibold text-[#1e2d3d]">
                        {row.cost_price !== "" || row.profit !== "" ? `GHS ${selling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.discount_price}
                        onChange={e => setSizePricingRows(prev => prev.map((r, j) => j === i ? { ...r, discount_price: e.target.value } : r))}
                        placeholder="—"
                        className={`${inputClass} ${row.discount_price && Number(row.discount_price) > 0 && Number(row.discount_price) < selling ? "border-red-400 text-red-600" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setSizePricingRows(prev => prev.filter((_, j) => j !== i))}
                        disabled={sizePricingRows.length === 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                      >×</button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSizePricingRows(prev => [...prev, { size: "", cost_price: "", profit: "", discount_price: "" }])}
                  className="text-xs font-semibold text-[#F2AA25] hover:text-amber-600 transition-colors mt-1"
                >+ Add Size</button>
                {sizePricingRows.some(r => r.size.trim() && r.cost_price !== "" && r.profit !== "") && (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                    Prices shown to customers:{" "}
                    <span className="font-semibold text-[#1e2d3d]">
                      From GHS {Math.min(...sizePricingRows.filter(r => r.cost_price !== "" && r.profit !== "").map(r => Number(r.cost_price) + Number(r.profit))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <input name="sizes" value={form.sizes} onChange={handleChange} placeholder="S,M,L,XL or King,Queen" className={inputClass} />
            )}
          </div>

          <div>
            <label className={labelClass}>Colours <span className="text-gray-400 font-normal">(comma-separated, optional)</span></label>
            <input name="colours" value={form.colours} onChange={handleChange} placeholder="Red,Blue,White" className={inputClass} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Product description…" className={`${inputClass} resize-none`} />
          </div>

          <div>
            <label className={labelClass}>Est. Shipping Fee (GHS) <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              name="estimated_shipping_fee"
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_shipping_fee}
              onChange={handleChange}
              placeholder="e.g. 30"
              className={inputClass}
            />
          </div>

          {error   && <p className="sm:col-span-2 text-red-500 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          {success && <p className="sm:col-span-2 text-green-600 text-xs bg-green-50 border border-green-100 rounded-xl px-3 py-2">{success}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#F2AA25] text-white font-bold text-sm px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
            >
              {submitting ? <><Spinner /> Uploading…</> : "Upload Product"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Products Table ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold text-[#1e2d3d] flex-1 whitespace-nowrap">
            Products ({filteredProducts.length}{filteredProducts.length !== products.length ? ` of ${products.length}` : ""})
          </h2>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name…"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="border border-gray-200 rounded-xl pl-8 pr-8 py-2 text-xs outline-none focus:border-[#F2AA25] transition-colors w-44"
            />
            {productSearch && (
              <button
                onClick={() => setProductSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#F2AA25] transition-colors"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.category_id} value={String(c.category_id)}>{c.category_name}</option>
            ))}
          </select>

          {/* Clear filters */}
          {(productSearch || categoryFilter) && (
            <button
              onClick={() => { setProductSearch(""); setCategoryFilter(""); }}
              className="text-xs text-gray-400 hover:text-gray-700 font-semibold transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {products.length === 0 ? "No products yet. Upload one above." : "No products match your search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Final Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Cost Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Profit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Media</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
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
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.category?.category_name ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-[#F2AA25]">GHS {Number(p.unit_price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">GHS {Number(p.cost_price ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">GHS {Number(p.profit ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.product_status?.status_name === "Available"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {p.product_status?.status_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        {p.product_image_url   && <span title="Image 1" className="text-xs bg-blue-50 text-blue-600 font-semibold px-1.5 py-0.5 rounded">IMG1</span>}
                        {p.product_image_url_2 && <span title="Image 2" className="text-xs bg-blue-50 text-blue-600 font-semibold px-1.5 py-0.5 rounded">IMG2</span>}
                        {p.product_video_url   && <span title="Video"   className="text-xs bg-purple-50 text-purple-600 font-semibold px-1.5 py-0.5 rounded">VID</span>}
                        {!p.product_image_url && !p.product_image_url_2 && !p.product_video_url && <span className="text-gray-300 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleEditOpen(p)}
                          className="text-xs font-semibold text-[#F2AA25] hover:text-amber-600 transition-colors"
                        >Edit</button>
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p.product_id}
                          className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          {deletingId === p.product_id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleEditClose} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-sm font-bold text-[#1e2d3d]">Edit Product</h2>
              <button
                onClick={handleEditClose}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Product Name *</label>
                  <input name="product_name" value={editForm.product_name} onChange={handleEditChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Category *</label>
                  <select name="category_id" value={editForm.category_id} onChange={handleEditChange} className={inputClass}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Status *</label>
                  <select name="status_id" value={editForm.status_id} onChange={handleEditChange} className={inputClass}>
                    <option value="">Select status</option>
                    {statuses.map(s => <option key={s.product_status_id} value={s.product_status_id}>{s.status_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Cost Price (GHS){editUseSizePricing ? " (optional)" : " *"}</label>
                  <input name="cost_price" type="number" min="0" step="0.01" value={editForm.cost_price} onChange={handleEditChange} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Profit (GHS)</label>
                  <input name="profit" type="number" min="0" step="0.01" value={editForm.profit} onChange={handleEditChange} className={inputClass} />
                </div>

                {!editUseSizePricing && (editForm.cost_price || editForm.profit) && (
                  <div className="sm:col-span-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5">
                    Final Price:{" "}
                    <span className="font-bold text-[#1e2d3d]">
                      GHS {(Number(editForm.cost_price || 0) + Number(editForm.profit || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {editForm.discount_price && Number(editForm.discount_price) > 0 && Number(editForm.discount_price) < (Number(editForm.cost_price || 0) + Number(editForm.profit || 0)) && (
                      <span className="ml-2 text-red-600 font-bold">→ Discounted: GHS {Number(editForm.discount_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                )}

                {!editUseSizePricing && (
                  <div>
                    <label className={labelClass}>Discounted Price (GHS) <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      name="discount_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.discount_price}
                      onChange={handleEditChange}
                      placeholder="Leave blank for no discount"
                      className={inputClass}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Must be less than selling price to apply.</p>
                  </div>
                )}

                {/* Media section */}
                <div className="sm:col-span-2">
                  <p className="text-xs font-bold text-[#1e2d3d] mb-3 uppercase tracking-wide">Product Media</p>
                  <div className="grid grid-cols-1 gap-4">
                    <ImagePickerField
                      label="Image 1 (Main)"
                      file={editImageFile}
                      preview={editImagePreview}
                      existingUrl={editingProduct.product_image_url}
                      onChange={makeImagePicker(setEditImageFile, setEditImagePreview)}
                      onClear={() => { setEditImageFile(null); setEditImagePreview(null); }}
                    />
                    <ImagePickerField
                      label="Image 2"
                      file={editImageFile2}
                      preview={editImagePreview2}
                      existingUrl={editingProduct.product_image_url_2}
                      onChange={makeImagePicker(setEditImageFile2, setEditImagePreview2)}
                      onClear={() => { setEditImageFile2(null); setEditImagePreview2(null); }}
                    />
                    <div>
                      <label className={labelClass}>TikTok Video Link <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="url"
                        value={editTiktokUrl}
                        onChange={e => setEditTiktokUrl(e.target.value)}
                        placeholder="https://www.tiktok.com/@user/video/..."
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Media will display as a slideshow: Image 1 → Image 2 → TikTok link</p>
                </div>

                {/* Sizes / Size-based pricing (edit) */}
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2.5 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={editUseSizePricing}
                      onChange={e => setEditUseSizePricing(e.target.checked)}
                      className="w-4 h-4 accent-[#F2AA25]"
                    />
                    <span className="text-xs font-semibold text-[#1e2d3d]">
                      Enable size-based pricing <span className="text-gray-400 font-normal">(different price per size)</span>
                    </span>
                  </label>

                  {editUseSizePricing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-gray-400 px-1">
                        <span>Size Name</span>
                        <span>Cost Price (GHS)</span>
                        <span>Profit (GHS)</span>
                        <span>Selling Price</span>
                        <span>Discount (opt.)</span>
                        <span />
                      </div>
                      {editSizePricingRows.map((row, i) => {
                        const selling = (Number(row.cost_price) || 0) + (Number(row.profit) || 0);
                        return (
                          <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                            <input
                              value={row.size}
                              onChange={e => setEditSizePricingRows(prev => prev.map((r, j) => j === i ? { ...r, size: e.target.value } : r))}
                              placeholder="e.g. Small"
                              className={inputClass}
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.cost_price}
                              onChange={e => setEditSizePricingRows(prev => prev.map((r, j) => j === i ? { ...r, cost_price: e.target.value } : r))}
                              placeholder="0.00"
                              className={inputClass}
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.profit}
                              onChange={e => setEditSizePricingRows(prev => prev.map((r, j) => j === i ? { ...r, profit: e.target.value } : r))}
                              placeholder="0.00"
                              className={inputClass}
                            />
                            <div className="border border-gray-100 bg-gray-50 rounded-xl px-3 py-2 text-xs font-semibold text-[#1e2d3d]">
                              {row.cost_price !== "" || row.profit !== "" ? `GHS ${selling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.discount_price}
                              onChange={e => setEditSizePricingRows(prev => prev.map((r, j) => j === i ? { ...r, discount_price: e.target.value } : r))}
                              placeholder="—"
                              className={`${inputClass} ${row.discount_price && Number(row.discount_price) > 0 && Number(row.discount_price) < selling ? "border-red-400 text-red-600" : ""}`}
                            />
                            <button
                              type="button"
                              onClick={() => setEditSizePricingRows(prev => prev.filter((_, j) => j !== i))}
                              disabled={editSizePricingRows.length === 1}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                            >×</button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setEditSizePricingRows(prev => [...prev, { size: "", cost_price: "", profit: "", discount_price: "" }])}
                        className="text-xs font-semibold text-[#F2AA25] hover:text-amber-600 transition-colors mt-1"
                      >+ Add Size</button>
                      {editSizePricingRows.some(r => r.size.trim() && r.cost_price !== "" && r.profit !== "") && (
                        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                          Prices shown to customers:{" "}
                          <span className="font-semibold text-[#1e2d3d]">
                            From GHS {Math.min(...editSizePricingRows.filter(r => r.cost_price !== "" && r.profit !== "").map(r => Number(r.cost_price) + Number(r.profit))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <input name="sizes" value={editForm.sizes} onChange={handleEditChange} placeholder="S,M,L,XL" className={inputClass} />
                  )}
                </div>

                <div>
                  <label className={labelClass}>Colours <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                  <input name="colours" value={editForm.colours} onChange={handleEditChange} placeholder="Red,Blue,White" className={inputClass} />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea name="description" value={editForm.description} onChange={handleEditChange} rows={3} className={`${inputClass} resize-none`} />
                </div>

                <div>
                  <label className={labelClass}>Est. Shipping Fee (GHS) <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    name="estimated_shipping_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.estimated_shipping_fee}
                    onChange={handleEditChange}
                    placeholder="e.g. 30"
                    className={inputClass}
                  />
                </div>

                {editError && (
                  <p className="sm:col-span-2 text-red-500 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2">{editError}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={handleEditClose}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors px-4 py-2 rounded-xl hover:bg-gray-100"
              >Cancel</button>
              <button
                onClick={handleEditSubmit}
                disabled={editSubmitting}
                className="bg-[#F2AA25] text-white font-bold text-sm px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
              >
                {editSubmitting ? <><Spinner /> Saving…</> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
