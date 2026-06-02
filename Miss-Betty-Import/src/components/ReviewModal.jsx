import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>
);

function StarRating({ rating, hovered, onRate, onHover, onLeave }) {
  return (
    <div className="flex items-center gap-1" onMouseLeave={onLeave}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          onMouseEnter={() => onHover(star)}
          className="transition-transform hover:scale-110"
          aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={star <= (hovered || rating) ? "#F2AA25" : "none"}
              stroke={star <= (hovered || rating) ? "#F2AA25" : "#d1d5db"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

const LABELS = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very Good", 5: "Excellent" };

export default function ReviewModal({ isOpen, onClose, onSubmitted, product }) {
  const { session } = useAuth();

  const [rating,       setRating]       = useState(0);
  const [hovered,      setHovered]      = useState(0);
  const [comment,      setComment]      = useState("");
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState("");

  // Reset form when modal opens for a new product
  useEffect(() => {
    if (isOpen) {
      setRating(0); setHovered(0); setComment("");
      setImageFile(null); setImagePreview(null); setError("");
    }
  }, [isOpen, product?.product_id]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  async function handleSubmit() {
    if (rating === 0) return setError("Please select a star rating.");
    setError("");
    setSubmitting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const ext  = imageFile.name.split(".").pop();
        const path = `${product.product_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("review-images")
          .upload(path, imageFile, { contentType: imageFile.type });
        if (uploadErr) throw new Error(uploadErr.message);
        const { data: { publicUrl } } = supabase.storage.from("review-images").getPublicUrl(path);
        imageUrl = publicUrl;
      }

      const { data: cust, error: custErr } = await supabase
        .from("customers")
        .select("customer_id, customer_name")
        .eq("auth_id", session.user.id)
        .single();
      if (custErr) throw new Error(custErr.message);

      const { error: insertErr } = await supabase.from("reviews").insert({
        product_id:    product.product_id,
        customer_id:   cust.customer_id,
        order_id:      product.order_id,
        rating,
        comment:       comment.trim() || null,
        image_url:     imageUrl,
        reviewer_name: cust.customer_name,
      });
      if (insertErr) throw new Error(insertErr.message);

      onSubmitted();
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-[#1e2d3d]">Write a Review</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[260px]">{product.product_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
          {/* Star rating */}
          <div>
            <p className="text-xs font-semibold text-[#1e2d3d] mb-2">Your Rating *</p>
            <StarRating
              rating={rating}
              hovered={hovered}
              onRate={setRating}
              onHover={setHovered}
              onLeave={() => setHovered(0)}
            />
            {(hovered || rating) > 0 && (
              <p className="text-xs text-[#F2AA25] font-semibold mt-1">
                {LABELS[hovered || rating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">
              Comment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
              placeholder="Share your experience with this product…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F2AA25] resize-none"
            />
          </div>

          {/* Image upload */}
          <div>
            <p className="text-xs font-semibold text-[#1e2d3d] mb-2">
              Photo <span className="text-gray-400 font-normal">(optional)</span>
            </p>
            {imagePreview ? (
              <div className="relative w-24 h-24">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                >×</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                <span className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-[#1e2d3d] font-semibold text-xs px-3 py-2 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  Upload Photo
                </span>
              </label>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors px-4 py-2 rounded-xl hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#F2AA25] text-white font-bold text-sm px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
          >
            {submitting ? <><Spinner /> Submitting…</> : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
