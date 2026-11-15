import { lazy, Suspense, useEffect, useState } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";

// The festive code is only downloaded while Christmas Animations are switched on.
const ChristmasTop = lazy(() => import("./ChristmasTop"));
const ChristmasMain = lazy(() => import("./ChristmasMain"));

// Placed on the Home and Shop pages: slot="top" before the shop header (red promo strip), and
// the default slot right after it (photo hero, trust strip, page snow). Follows the admin's
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
  const Part = slot === "top" ? ChristmasTop : ChristmasMain;
  return (
    <Suspense fallback={null}>
      <Part christmas={christmas} leaving={!christmasActive} />
    </Suspense>
  );
}
