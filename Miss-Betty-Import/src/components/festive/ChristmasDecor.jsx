import { lazy, Suspense, useEffect, useState } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";

// The festive code is only downloaded while Christmas Animations are switched on.
const ChristmasSeason = lazy(() => import("./ChristmasSeason"));

// One line on the Home and Shop pages. Follows the admin's central switch live (app_settings
// realtime): switching on brings the decorations in, switching off fades them away.
export default function ChristmasDecor() {
  const { christmasActive, christmasHeadline, christmasMessage } = useAppSettings();
  // Stays mounted for the fade-out after the switch goes off.
  const [shown, setShown] = useState(christmasActive);
  if (christmasActive && !shown) setShown(true);

  useEffect(() => {
    if (christmasActive) return;
    const t = setTimeout(() => setShown(false), 520);
    return () => clearTimeout(t);
  }, [christmasActive]);

  if (!shown) return null;
  return (
    <Suspense fallback={null}>
      <ChristmasSeason headline={christmasHeadline} message={christmasMessage} leaving={!christmasActive} />
    </Suspense>
  );
}
