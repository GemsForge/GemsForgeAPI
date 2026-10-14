import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";

export function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}><AppRoutes /></BrowserRouter>;
}
