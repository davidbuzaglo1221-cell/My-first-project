import "@fontsource/ibm-plex-sans-hebrew/hebrew-400.css";
import "@fontsource/frank-ruhl-libre/hebrew-500.css";
import "@fontsource/frank-ruhl-libre/hebrew-700.css";
import "@fontsource/frank-ruhl-libre/latin-500.css";
import "@fontsource/frank-ruhl-libre/latin-700.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-500.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-600.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-700.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-400.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-500.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-600.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-700.css";
import "../app/globals.css";

import { StrictMode, useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "@/components/app/providers";
import { startSync } from "@/data/sync";
import { startRouter, useLocation } from "./router";

import Home from "../app/page";
import Achievements from "../app/achievements/page";
import Body from "../app/body/page";
import Cardio from "../app/cardio/page";
import Exercises from "../app/exercises/page";
import ExerciseView from "../app/exercises/view/page";
import History from "../app/history/page";
import HistoryView from "../app/history/view/page";
import Learn from "../app/learn/page";
import LearnRead from "../app/learn/read/page";
import Nutrition from "../app/nutrition/page";
import NutritionAdd from "../app/nutrition/add/page";
import NutritionBarcode from "../app/nutrition/barcode/page";
import NutritionGoals from "../app/nutrition/goals/page";
import NutritionPhoto from "../app/nutrition/photo/page";
import Photos from "../app/photos/page";
import Profile from "../app/profile/page";
import Progress from "../app/progress/page";
import Summary from "../app/summary/page";
import TemplateEdit from "../app/templates/edit/page";
import Welcome from "../app/welcome/page";
import Workout from "../app/workout/page";
import Workouts from "../app/workouts/page";
import Journey from "../app/journey/page";
import JourneyStart from "../app/journey/start/page";
import Mission from "../app/mission/page";
import CheckIn from "../app/checkin/page";
import Business from "../app/business/page";
import BusinessLog from "../app/business/log/page";
import BusinessMoney from "../app/business/money/page";
import Coach from "../app/coach/page";
import CoachSales from "../app/coach/sales/page";
import Review from "../app/review/page";

const ROUTES: Record<string, ComponentType> = {
  "/": Home,
  "/achievements": Achievements,
  "/body": Body,
  "/cardio": Cardio,
  "/exercises": Exercises,
  "/exercises/view": ExerciseView,
  "/history": History,
  "/history/view": HistoryView,
  "/learn": Learn,
  "/learn/read": LearnRead,
  "/nutrition": Nutrition,
  "/nutrition/add": NutritionAdd,
  "/nutrition/barcode": NutritionBarcode,
  "/nutrition/goals": NutritionGoals,
  "/nutrition/photo": NutritionPhoto,
  "/photos": Photos,
  "/profile": Profile,
  "/progress": Progress,
  "/summary": Summary,
  "/templates/edit": TemplateEdit,
  "/welcome": Welcome,
  "/workout": Workout,
  "/workouts": Workouts,
  "/journey": Journey,
  "/journey/start": JourneyStart,
  "/mission": Mission,
  "/checkin": CheckIn,
  "/business": Business,
  "/business/log": BusinessLog,
  "/business/money": BusinessMoney,
  "/coach": Coach,
  "/coach/sales": CoachSales,
  "/review": Review,
};

// The saved theme, before the first paint (the same job as THEME_BOOT in the Next layout).
const root = document.documentElement;
root.lang = "he";
root.dir = "rtl";
root.dataset.theme = "dark";
try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") root.dataset.theme = t;
  else if (t === "system") root.removeAttribute("data-theme");
} catch {
  // Storage blocked: dark until the profile loads.
}

startRouter(Object.keys(ROUTES));

function Screen() {
  const { pathname, search } = useLocation();
  const Page = ROUTES[pathname] ?? Home;
  // Keyed by the whole address, like a page load: state never leaks from one screen to the next.
  return <Page key={pathname + search} />;
}

/** Waits for the first pull from the Claude account on a phone that has nothing yet, so the
 * welcome screen never shows to someone whose data is on the way. */
function Ready({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) setReady((done = true));
    };
    startSync().then(finish, finish);
    const t = setTimeout(finish, 15000);
    return () => clearTimeout(t);
  }, []);
  if (ready) return <>{children}</>;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-text-muted" role="status">
      <span className="size-10 animate-spin rounded-pill border-4 border-accent/20 border-t-accent" aria-hidden />
      <span className="text-sm">טוען את הנתונים שלך…</span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <Ready>
        <Screen />
      </Ready>
    </Providers>
  </StrictMode>,
);
