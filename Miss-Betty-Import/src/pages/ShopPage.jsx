import { Fragment, useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppSettings } from "../context/AppSettingsContext";
import BottomNav from "../components/BottomNav";
import useActiveCountdown from "../hooks/useActiveCountdown";
import { supabase } from "../lib/supabase";
import usePersistedState from "../hooks/usePersistedState";
import useScrollRestoration from "../hooks/useScrollRestoration";
import useSeo from "../hooks/useSeo";
import useIncrementalList from "../hooks/useIncrementalList";
import ProductCard from "../components/shop/ProductCard";
import PromoShelf from "../components/shop/PromoShelf";
import usePromoShelves from "../hooks/usePromoShelves";
import { shelfAfter } from "../lib/promotions";
import ShopHeader from "../components/shop/ShopHeader";
import ShopNotice from "../components/shop/ShopNotice";
import ShopFooter from "../components/shop/ShopFooter";
import { GRID_CLASS, ProductGridSkeleton, NoProductsFound, ShowMore } from "../components/shop/ProductGrid";
import ProductDetailModal from "../components/shop/ProductDetailModal";
import ImageLightbox from "../components/shop/ImageLightbox";


function mapProduct(p) {
  const rawSizePricing = Array.isArray(p.size_pricing) && p.size_pricing.length > 0
    ? p.size_pricing : null;
  const sizePricing = rawSizePricing
    ? rawSizePricing.map(r => ({
        ...r,
        discount_price: r.discount_price != null ? Number(r.discount_price) : null,
      }))
    : null;
  const discountedSizes = (sizePricing ?? []).filter(r => r.discount_price != null);
  const minDiscountPrice = discountedSizes.length
    ? Math.min(...discountedSizes.map(r => r.discount_price))
    : null;
  const productDiscountPrice = p.discount_price != null ? Number(p.discount_price) : null;
  const discount_price = sizePricing ? minDiscountPrice : productDiscountPrice;
  return {
    id: p.product_id,
    category: p.category?.category_name ?? 'Others',
    product_name: p.product_name,
    product_image_url:   p.product_image_url   ?? '',
    product_image_url_2: p.product_image_url_2 ?? '',
    product_video_url:   p.product_video_url   ?? '',
    extra_image_urls: Array.isArray(p.extra_image_urls) ? p.extra_image_urls.filter(Boolean) : [],
    videos: Array.isArray(p.product_videos) ? p.product_videos.filter(v => v?.url) : [],
    unit_price: Number(p.unit_price),
    cost_price: Number(p.cost_price ?? 0),
    profit:     Number(p.profit ?? 0),
    rmb_price:  Number(p.rmb_price ?? 0), // admin-only procurement cost; never rendered on this customer-facing page
    misc_amount: Number(p.misc_amount ?? 0), // admin-only; never rendered on this customer-facing page
    discount_price,
    description: p.description ?? '',
    sizePricing,
    sizes: sizePricing
      ? sizePricing.map(sp => sp.size)
      : (p.size ? p.size.split(',').map(s => s.trim()).filter(Boolean) : []),
    colours: p.colour ? p.colour.split(',').map(c => c.trim()).filter(Boolean) : [],
    product_status: p.product_status?.status_name ?? 'Available',
    estimated_shipping_fee_min: p.estimated_shipping_fee_min ?? null,
    estimated_shipping_fee_max: p.estimated_shipping_fee_max ?? null,
    variantStock: p.product_variant_stock ?? [],
    variant_images: p.variant_images ?? null,
  };
}


export default function ShopPage() {
  const { ordersClosed } = useAppSettings();
  const [search, setSearch] = usePersistedState("mbimport_form_shop_filters_search", "");
  const [activeCategory, setActiveCategory] = usePersistedState("mbimport_form_shop_filters_category", "All");
  const [statusFilter, setStatusFilter] = usePersistedState("mbimport_form_shop_filters_status", "All");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [lightboxImage, setLightboxImage] = useState(null);
  const countdownData = useActiveCountdown();

  useScrollRestoration("mbimport_scroll_shop", !loadingProducts);
  useSeo({ title: "Shop Imported Products in Ghana", description: "Browse kitchen appliances, sneakers, bags, fashion, home and baby products. Buy in-stock items or pre-order from China, with delivery across Ghana.", path: "/shop" });



  useEffect(() => {
    async function loadData() {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('products')
          .select('*, category(category_name), product_status(status_name), product_variant_stock(*)')
          .is('archived_at', null)
          .order('product_id', { ascending: false }),
        supabase.from('category').select('*').order('category_name'),
      ]);
      setProducts((prods ?? []).map(mapProduct));
      setDbCategories(cats ?? []);
      setLoadingProducts(false);
    }
    loadData();
  }, []);

  // Live stock updates: a purchase decrements product_variant_stock server-side via a
  // Postgres trigger (a plain UPDATE), so subscribing here keeps every card's displayed
  // count current for every customer, without a page refresh.
  useEffect(() => {
    const channel = supabase
      .channel('product_variant_stock_shop')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'product_variant_stock' },
        (payload) => {
          setProducts(prev => prev.map(p =>
            p.id === payload.new.product_id
              ? { ...p, variantStock: p.variantStock.map(r => r.id === payload.new.id ? payload.new : r) }
              : p
          ));
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.product_name.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchStatus = statusFilter === "All" || p.product_status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [products, search, activeCategory, statusFilter]);
  const { shelves, every: shelfEvery } = usePromoShelves({ products, filters: { search, activeCategory, statusFilter }, ordersClosed, total: filtered.length });
  const { visible: visibleProducts, sentinelRef: moreRef, hasMore: hasMoreProducts, showAll: showAllProducts } =
    useIncrementalList(filtered, "mbimport_list_shop", `${search}|${activeCategory}|${statusFilter}`);

  const cardProps = {
    onSelect: setSelectedProduct,
    onViewImage: (src, alt) => setLightboxImage({ src, alt }),
    onBuyNow: setBuyNowProduct,
    ordersClosed,
  };

  return (
    <div className="min-h-screen bg-white">
      <ShopHeader
        logoTo="/shop"
        showBell={true}
        search={search}
        onSearch={setSearch}
        categories={dbCategories}
        activeCategory={activeCategory}
        onCategory={setActiveCategory}
        statusFilter={statusFilter}
        onStatus={setStatusFilter}
        countdownData={countdownData}
      />
      <ShopNotice countdownData={countdownData} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-16">
        <h1 className="sr-only">Shop imported products in Ghana</h1>

        {loadingProducts ? (
          <ProductGridSkeleton />
        ) : filtered.length > 0 ? (
          <>
            <div className={GRID_CLASS}>
              {visibleProducts.map((p, i) => {
                const shelf = shelfAfter(i, filtered.length, shelves, shelfEvery);
                return (
                  <Fragment key={p.id}>
                    <ProductCard priority={i < 4} product={p} {...cardProps} />
                    {shelf && <PromoShelf kind={shelf.kind} items={shelf.items} cardProps={cardProps} />}
                  </Fragment>
                );
              })}
            </div>
            {hasMoreProducts && <ShowMore moreRef={moreRef} onShowAll={showAllProducts} />}
          </>
        ) : (
          <NoProductsFound onClear={() => { setSearch(""); setActiveCategory("All"); setStatusFilter("All"); }} />
        )}
      </main>

      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
      {buyNowProduct && (
        <ProductDetailModal product={buyNowProduct} onClose={() => setBuyNowProduct(null)} buyNow />
      )}

      {lightboxImage && (
        <ImageLightbox src={lightboxImage.src} alt={lightboxImage.alt} onClose={() => setLightboxImage(null)} />
      )}

      <ShopFooter />
      <BottomNav />
    </div>
  );
}
