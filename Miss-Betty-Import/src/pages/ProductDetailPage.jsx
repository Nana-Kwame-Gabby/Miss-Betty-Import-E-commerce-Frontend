import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { colourMap } from "../data/mockData";
import { useCart } from "../context/CartContext";
import { supabase } from "../lib/supabase";
import MediaCarousel from "../components/MediaCarousel";
import ReviewsSection from "../components/ReviewsSection";

function mapProduct(p) {
  return {
    id: p.product_id,
    category: p.category?.category_name ?? 'Others',
    product_name: p.product_name,
    product_image_url:   p.product_image_url   ?? '',
    product_image_url_2: p.product_image_url_2 ?? '',
    product_video_url:   p.product_video_url   ?? '',
    unit_price: Number(p.unit_price),
    description: p.description ?? '',
    sizes: p.size ? p.size.split(',').map(s => s.trim()).filter(Boolean) : [],
    colours: p.colour ? p.colour.split(',').map(c => c.trim()).filter(Boolean) : [],
    product_status: p.product_status?.status_name ?? 'Available',
  };
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColour, setSelectedColour] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select('*, category(category_name), product_status(status_name)')
        .eq('product_id', Number(id))
        .single();
      if (data) {
        const mapped = mapProduct(data);
        setProduct(mapped);
        setSelectedSize(mapped.sizes[0] ?? null);
        setSelectedColour(mapped.colours[0] ?? null);
      }
      setLoading(false);
    }
    loadProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">🔍</p>
        <p className="text-gray-500 text-lg font-medium">Product not found</p>
        <Link to="/shop" className="mt-4 inline-block text-[#F2AA25] font-semibold hover:underline">← Back to Shop</Link>
      </div>
    );
  }

  function handleAddToCart() {
    if (!selectedSize && product.sizes.length > 0) return setError("Please select a size.");
    if (!selectedColour && product.colours.length > 0) return setError("Please select a colour.");
    setError("");
    addToCart(product, quantity, selectedSize, selectedColour);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  function handleBuyNow() {
    if (!selectedSize && product.sizes.length > 0) return setError("Please select a size.");
    if (!selectedColour && product.colours.length > 0) return setError("Please select a colour.");
    setError("");
    navigate("/checkout", {
      state: {
        buyNow: { product, quantity, size: selectedSize, colour: selectedColour },
      },
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/home" className="hover:text-[#F2AA25]">Home</Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-[#F2AA25]">Shop</Link>
        <span>/</span>
        <span className="text-[#1e2d3d] font-medium">{product.product_name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Media carousel */}
        <div className="rounded-2xl overflow-hidden shadow-sm">
          <MediaCarousel
            heightClass="h-56 sm:h-72"
            name={product.product_name}
            media={[
              { type: "image", url: product.product_image_url },
              { type: "image", url: product.product_image_url_2 },
              { type: "tiktok", url: product.product_video_url },
            ]}
          />
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <span className="text-sm text-gray-400 font-medium uppercase tracking-wide mb-1">{product.category}</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1e2d3d] mb-2">{product.product_name}</h1>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-[#F2AA25] font-bold text-2xl">GHS {product.unit_price.toLocaleString()}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              product.product_status === "Available"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {product.product_status}
            </span>
          </div>

          {product.description && (
            <p className="text-gray-500 text-sm leading-relaxed mb-4">{product.description}</p>
          )}

          {/* Size selector */}
          {product.sizes.length > 0 && (
            <div className="mb-4">
              <p className="font-semibold text-[#1e2d3d] mb-2 text-sm">
                Size <span className="text-gray-400 font-normal ml-1">{selectedSize && `— ${selectedSize}`}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors ${
                      selectedSize === size
                        ? "border-[#F2AA25] bg-[#F2AA25] text-white"
                        : "border-gray-200 text-[#1e2d3d] hover:border-[#F2AA25]"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colour selector */}
          {product.colours.length > 0 && (
            <div className="mb-4">
              <p className="font-semibold text-[#1e2d3d] mb-2 text-sm">
                Colour <span className="text-gray-400 font-normal ml-1">{selectedColour && `— ${selectedColour}`}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                {product.colours.map(colour => {
                  const bg = colourMap[colour] || "#ccc";
                  const isSelected = selectedColour === colour;
                  return (
                    <button
                      key={colour}
                      onClick={() => setSelectedColour(colour)}
                      title={colour}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        isSelected ? "border-[#F2AA25] scale-110" : "border-gray-200 hover:border-gray-400"
                      }`}
                      style={{ background: bg }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-4">
            <p className="font-semibold text-[#1e2d3d] mb-2 text-sm">Quantity</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-[#1e2d3d] hover:border-[#F2AA25] transition-colors"
              >−</button>
              <span className="w-10 text-center font-semibold text-[#1e2d3d]">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-[#1e2d3d] hover:border-[#F2AA25] transition-colors"
              >+</button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAddToCart}
              className={`flex-1 font-bold py-3 rounded-2xl text-white transition-all ${
                added ? "bg-green-500" : "bg-[#F2AA25] hover:opacity-90"
              }`}
            >
              {added ? "✓ Added to Cart!" : "Add to Cart"}
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 font-bold py-3 rounded-2xl border-2 border-[#1e2d3d] text-[#1e2d3d] hover:bg-[#1e2d3d] hover:text-white transition-colors"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <ReviewsSection productId={Number(id)} />
    </div>
  );
}
