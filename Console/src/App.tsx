import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { AuthProvider } from "./auth/AuthProvider";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
