import { Empty } from "../components/ui";
import { go } from "../lib/router";

export function NotFound() {
  return (
    <main className="page">
      <Empty title="העמוד לא נמצא" text="הקישור ישן או שגוי. חזור למסך הבית." action={<button className="btn primary small-btn" onClick={() => go("/")}>לבית</button>} />
    </main>
  );
}
