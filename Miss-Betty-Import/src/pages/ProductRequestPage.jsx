import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

function ImagePickerField({ label, file, existingUrl, onChange, onClear }) {
  const inputRef = useRef(null);
  const src = file ? URL.createObjectURL(file) : existingUrl || null;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide">{label}</label>
      <div className="flex items-start gap-4">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
          {src ? (
            <img src={src} alt="preview" className="w-full h-full object-cover rounded-xl border border-gray-200" />
          ) : (
            <div className="w-full h-full bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className="text-xs text-gray-400">No image</span>
            </div>
          )}
          {src && (
            <button
              type="button"
              onClick={onClear}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
            >×</button>
          )}
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 text-sm font-semibold text-[#1e2d3d] border border-gray-300 rounded-xl px-3 py-2 hover:border-[#F2AA25] hover:text-[#F2AA25] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {src ? "Replace Image" : "Upload Image"}
          </button>
          <p className="text-xs text-gray-400">JPG, PNG, WEBP — max 10 MB</p>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { productName: "", details: "" };

export default function ProductRequestPage() {
  const { session } = useAuth();
  const [form, setForm]         = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function validate() {
    const e = {};
    if (!form.productName.trim()) e.productName = "Product name is required.";
    if (!imageFile) e.image = "Please upload an image of the product.";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setSubmitting(true);
    setSubmitError("");

    try {
      const { data: cust, error: custErr } = await supabase
        .from("customers")
        .select("customer_id")
        .eq("auth_id", session.user.id)
        .single();
      if (custErr || !cust) throw new Error("Could not find your account. Please try again.");

      // Upload image
      const ext  = imageFile.name.split(".").pop();
      const path = `${cust.customer_id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("product-requests").upload(path, imageFile);
      if (uploadErr) throw new Error("Image upload failed. Please try again.");
      const { data: { publicUrl } } = supabase.storage.from("product-requests").getPublicUrl(path);

      // Save request
      const { error: insertErr } = await supabase.from("product_requests").insert({
        customer_id:  cust.customer_id,
        product_name: form.productName.trim(),
        details:      form.details.trim() || null,
        image_url:    publicUrl,
      });
      if (insertErr) throw new Error(insertErr.message);

      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setErrors({});
    setSubmitError("");
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-3 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-2">Request Submitted!</h2>
          <p className="text-gray-500 text-sm mb-4 sm:mb-6">
            We've received your product request. Our team will review it and get back to you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleReset}
              className="flex-1 bg-[#F2AA25] text-white font-bold py-2.5 sm:py-3 rounded-2xl hover:opacity-90 transition-opacity text-sm"
            >
              Request Another Product
            </button>
            <Link
              to="/shop"
              className="flex-1 text-center border-2 border-[#1e2d3d] text-[#1e2d3d] font-bold py-2.5 sm:py-3 rounded-2xl hover:bg-[#1e2d3d] hover:text-white transition-colors text-sm"
            >
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = (field) =>
    `w-full border rounded-2xl px-3 py-2 sm:py-2.5 text-sm outline-none transition-colors ${
      errors[field] ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-[#F2AA25]"
    }`;

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <h1 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-1">Request a Product</h1>
      <p className="text-sm text-gray-400 mb-4">Can't find what you're looking for? Let us know and we'll try to source it.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col gap-4 sm:gap-5">
        {/* Image */}
        <div>
          <ImagePickerField
            label="Product Image *"
            file={imageFile}
            onChange={e => { setImageFile(e.target.files[0] || null); setErrors(prev => ({ ...prev, image: "" })); }}
            onClear={() => { setImageFile(null); setErrors(prev => ({ ...prev, image: "" })); }}
          />
          {errors.image && <p className="text-red-500 text-xs mt-1.5">{errors.image}</p>}
        </div>

        {/* Product Name */}
        <div>
          <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">Product Name *</label>
          <input
            type="text"
            placeholder="e.g. Nike Air Max 270, iPhone 15 Case…"
            value={form.productName}
            onChange={e => { setForm(prev => ({ ...prev, productName: e.target.value })); setErrors(prev => ({ ...prev, productName: "" })); }}
            className={inputClass("productName")}
          />
          {errors.productName && <p className="text-red-500 text-xs mt-1">{errors.productName}</p>}
        </div>

        {/* Details */}
        <div>
          <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">
            Additional Details <span className="text-gray-400 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            rows={4}
            placeholder="Describe the product — colour, size, brand, specifications, where you've seen it, etc."
            value={form.details}
            onChange={e => setForm(prev => ({ ...prev, details: e.target.value }))}
            className="w-full border border-gray-300 focus:border-[#F2AA25] rounded-2xl px-3 py-2 sm:py-2.5 text-sm outline-none transition-colors resize-none"
          />
        </div>

        {submitError && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{submitError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#F2AA25] text-white font-bold py-2.5 sm:py-3 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Submitting…
            </>
          ) : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
