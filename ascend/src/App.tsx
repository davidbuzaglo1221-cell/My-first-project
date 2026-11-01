import { useAppState } from "./lib/store";
import { useRoute } from "./lib/router";
import { TabBar } from "./components/TabBar";
import { ToastHost } from "./components/ui";
import { Onboarding } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { Training } from "./screens/Training";
import { Coach } from "./screens/Coach";
import { Tracking } from "./screens/Tracking";
import { Profile } from "./screens/Profile";
import { CheckIn, DailyReview, WeeklyReview } from "./screens/Forms";
import { NotFound } from "./screens/NotFound";

export function App() {
  const state = useAppState();
  const route = useRoute();
  const [head = "", ...rest] = route.path;

  if (!state.profile) {
    return (
      <div className="shell">
        <Onboarding />
        <ToastHost />
      </div>
    );
  }

  let screen;
  switch (head) {
    case "":
      screen = <Home />;
      break;
    case "train":
      screen = <Training rest={rest} query={route.query} />;
      break;
    case "coach":
      screen = <Coach />;
      break;
    case "track":
      screen = <Tracking />;
      break;
    case "habits":
      screen = <Tracking />;
      break;
    case "profile":
      screen = <Profile />;
      break;
    case "checkin":
      screen = <CheckIn dateParam={route.query.get("date")} />;
      break;
    case "review":
      screen = <DailyReview dateParam={route.query.get("date")} />;
      break;
    case "week":
      screen = <WeeklyReview />;
      break;
    default:
      screen = <NotFound />;
  }

  return (
    <div className="shell">
      {screen}
      <TabBar path={route.path} />
      <ToastHost />
    </div>
  );
}
