import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function StarDisplay({ rating, size = 16 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <svg key={star} width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={star <= rating ? "#F2AA25" : "none"}
            stroke={star <= rating ? "#F2AA25" : "#d1d5db"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSection({ productId }) {
  const [reviews,     setReviews]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  useEffect(() => {
    async function loadReviews() {
      const { data, error } = await supabase
        .from('reviews')
        .select('review_id, rating, comment, image_url, reviewer_name, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (error) console.error('Failed to load reviews:', error.message);
      setReviews(data ?? []);
      setLoading(false);
    }
    loadReviews();
  }, [productId]);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-[#1e2d3d]">
          Customer Reviews
          <span className="text-gray-400 font-normal ml-2 text-base">({reviews.length})</span>
        </h2>
        {avgRating && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-1">
            <StarDisplay rating={Math.round(Number(avgRating))} size={14} />
            <span className="text-sm font-bold text-[#F2AA25]">{avgRating}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-6">
          <div className="w-5 h-5 border-2 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400 text-sm">
          No reviews yet. Be the first to review this product!
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map(r => (
            <div key={r.review_id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-[#1e2d3d] text-sm">{r.reviewer_name ?? "Customer"}</p>
                  <StarDisplay rating={r.rating} size={14} />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              {r.comment && (
                <p className="text-sm text-gray-600 leading-relaxed mb-3">{r.comment}</p>
              )}
              {r.image_url && (
                <button onClick={() => setLightboxSrc(r.image_url)} className="mt-1">
                  <img
                    src={r.image_url}
                    alt="Review photo"
                    className="w-24 h-24 object-cover rounded-xl border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer"
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <img
            src={lightboxSrc}
            alt="Review photo"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
