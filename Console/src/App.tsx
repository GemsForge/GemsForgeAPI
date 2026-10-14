import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { LocalSession } from "./components/LocalSession";

export function App() {
  return <LocalSession><BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}><AppRoutes /></BrowserRouter></LocalSession>;
}
