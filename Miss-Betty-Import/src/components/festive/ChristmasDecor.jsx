import { lazy, Suspense, useEffect, useState } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";

// The festive code is only downloaded while Christmas Animations are switched on.
const ChristmasTop = lazy(() => import("./ChristmasTop"));
const ChristmasMain = lazy(() => import("./ChristmasMain"));
const ChristmasAmbience = lazy(() => import("./ChristmasAmbience"));

// Placed on the Home and Shop pages: slot="top" before the shop header (red promo strip), and
// the default slot right after it (photo hero, trust strip, plus the page-wide festive layer). Follows the admin's
// central switch live (app_settings realtime): on brings the decorations in, off fades them away.
export default function ChristmasDecor({ slot = "main" }) {
  const { christmasActive, christmas } = useAppSettings();
  // Stays mounted for the fade-out after the switch goes off.
  const [shown, setShown] = useState(christmasActive);
  if (christmasActive && !shown) setShown(true);

  useEffect(() => {
    if (christmasActive) return;
    const t = setTimeout(() => setShown(false), 520);
    return () => clearTimeout(t);
  }, [christmasActive]);

  if (!shown) return null;
  if (slot === "top") {
    return (
      <Suspense fallback={null}>
        <ChristmasTop christmas={christmas} leaving={!christmasActive} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={null}>
      <ChristmasMain christmas={christmas} leaving={!christmasActive} />
      <ChristmasAmbience leaving={!christmasActive} />
    </Suspense>
  );
}
