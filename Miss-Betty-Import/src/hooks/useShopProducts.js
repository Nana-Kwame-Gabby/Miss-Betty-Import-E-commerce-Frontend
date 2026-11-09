import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { PRODUCT_SELECT, mapProduct, mergeProducts } from "../lib/shopProduct";

const REFRESH_AFTER_HIDDEN = 60 * 1000; // a tab left in the background this long reloads on return
const BATCH_MS = 400;                    // gather a burst of admin edits into one read

// Products and categories for Home and Shop, kept in step with the admin while the page is open:
// - a price, name, photo or status edit replaces the product everywhere it shows (grid, shelves, pop-up);
// - deleting or archiving a product removes it; a new product appears;
// - stock changes from purchases update in place, and the stock rows the admin rewrites on save
//   are re-read with their product.
// `channel` must be unique per page.
export default function useShopProducts(channel) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const pending = useRef(new Set());
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      const [{ data: prods, error }, { data: cats }] = await Promise.all([
        supabase.from("products").select(PRODUCT_SELECT).is("archived_at", null).order("product_id", { ascending: false }),
        supabase.from("category").select("*").order("category_name"),
      ]);
      if (!alive) return;
      if (!error) setProducts((prods ?? []).map(mapProduct));
      setCategories(cats ?? []);
      setLoading(false);
    }

    // Re-read only the products that changed, in one request.
    async function flush() {
      timer.current = null;
      const ids = new Set(pending.current);
      pending.current.clear();
      if (ids.size === 0) return;
      const { data, error } = await supabase
        .from("products").select(PRODUCT_SELECT)
        .in("product_id", [...ids]).is("archived_at", null);
      if (!alive || error) return;
      setProducts(prev => mergeProducts(prev, ids, data ?? []));
    }
    function refetch(id) {
      if (id == null) return;
      pending.current.add(id);
      if (!timer.current) timer.current = setTimeout(flush, BATCH_MS);
    }

    loadAll();

    const sub = supabase
      .channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, payload => {
        if (payload.eventType === "DELETE") {
          const id = payload.old?.product_id;
          setProducts(prev => prev.filter(p => p.id !== id));
        } else {
          refetch(payload.new?.product_id);
        }
      })
      // A purchase lowers stock with a plain UPDATE: patch it straight in.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "product_variant_stock" }, payload => {
        setProducts(prev => prev.map(p =>
          p.id === payload.new.product_id
            ? { ...p, variantStock: p.variantStock.map(r => r.id === payload.new.id ? payload.new : r) }
            : p
        ));
      })
      // The admin's product save deletes and re-adds stock rows: re-read that product.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "product_variant_stock" }, payload => refetch(payload.new?.product_id))
      .subscribe();

    // If the live connection slept (phone locked, tab in the background), catch up on return.
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > REFRESH_AFTER_HIDDEN) { hiddenAt = null; loadAll(); }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      clearTimeout(timer.current);
      timer.current = null;
      supabase.removeChannel(sub);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [channel]);

  return { products, categories, loading };
}
