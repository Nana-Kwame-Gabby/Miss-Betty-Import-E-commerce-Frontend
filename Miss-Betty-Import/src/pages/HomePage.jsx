import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppSettings } from "../context/AppSettingsContext";
import BottomNav from "../components/BottomNav";
import useActiveCountdown from "../hooks/useActiveCountdown";
import usePersistedState from "../hooks/usePersistedState";
import useScrollRestoration from "../hooks/useScrollRestoration";
import useSeo from "../hooks/useSeo";
import useIncrementalList from "../hooks/useIncrementalList";
import useShopProducts from "../hooks/useShopProducts";
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


export default function HomePage() {
  const { ordersClosed } = useAppSettings();
  const [search, setSearch] = usePersistedState("mbimport_form_home_filters_search", "");
  const [activeCategory, setActiveCategory] = usePersistedState("mbimport_form_home_filters_category", "All");
  const [statusFilter, setStatusFilter] = usePersistedState("mbimport_form_home_filters_status", "All");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const countdownData = useActiveCountdown();
  // Live product list: admin price edits, deletions and new products show without a reload.
  const { products, categories: dbCategories, loading: loadingProducts } = useShopProducts("products_live_home");

  useScrollRestoration("mbimport_scroll_home", !loadingProducts);
  useSeo({ path: "/" });

  // Auto-open a product's modal when arriving via a shared /product/:id link
  // (the public gateway routes unauthenticated visitors here as /?product=<id>).
  // Keyed by id (not a one-shot flag) so re-opens are skipped once a given shared
  // product has been shown/dismissed, but a different shared link can still open —
  // without this, every realtime product_variant_stock update anywhere in the store
  // changes `products`' reference and would otherwise silently reopen the modal the
  // visitor just closed, trapping them instead of letting them browse the Home page.
  const handledSharedIdRef = useRef(null);
  useEffect(() => {
    const sharedId = searchParams.get('product');
    if (sharedId && sharedId !== handledSharedIdRef.current && products.length > 0) {
      const match = products.find(p => String(p.id) === sharedId);
      if (match) {
        setSelectedProduct(match);
        handledSharedIdRef.current = sharedId;
      }
    }
  }, [searchParams, products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.product_name.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchStatus = statusFilter === "All" || p.product_status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [products, search, activeCategory, statusFilter]);
  const { shelves, every: shelfEvery } = usePromoShelves({ products, filters: { search, activeCategory, statusFilter }, total: filtered.length });
  const { visible: visibleProducts, sentinelRef: moreRef, hasMore: hasMoreProducts, showAll: showAllProducts } =
    useIncrementalList(filtered, "mbimport_list_home", `${search}|${activeCategory}|${statusFilter}`);

  const live = p => (p ? products.find(x => x.id === p.id) ?? p : null);
  const liveSelected = live(selectedProduct);
  const liveBuyNow = live(buyNowProduct);

  const cardProps = {
    onSelect: setSelectedProduct,
    onViewImage: (src, alt) => setLightboxImage({ src, alt }),
    onBuyNow: setBuyNowProduct,
    ordersClosed,
  };

  return (
    <div className="min-h-screen bg-white">
      <ShopHeader
        logoTo="/"
        showBell={false}
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
        <h1 className="sr-only">Miss Betty Import: quality imported products in Ghana, in stock and on pre-order</h1>

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
        <ProductDetailModal
          product={liveSelected}
          onClose={() => {
            setSelectedProduct(null);
            if (searchParams.get('product')) setSearchParams({}, { replace: true });
          }}
        />
      )}
      {buyNowProduct && (
        <ProductDetailModal product={liveBuyNow} onClose={() => setBuyNowProduct(null)} buyNow />
      )}

      {lightboxImage && (
        <ImageLightbox src={lightboxImage.src} alt={lightboxImage.alt} onClose={() => setLightboxImage(null)} />
      )}

      <BottomNav />

      <ShopFooter />
    </div>
  );
}
