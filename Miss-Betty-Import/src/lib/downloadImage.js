// Saves a product photo to the device (falls back to opening it when the download is blocked).
export async function downloadImage(e, url, name) {
  e.stopPropagation();
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    const tmp  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = tmp;
    a.download = name || "product-image";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(tmp);
  } catch {
    window.open(url, "_blank");
  }
}
