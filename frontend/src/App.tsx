import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { BusinessPage } from "./pages/BusinessPage";
import { HomePage } from "./pages/HomePage";
import { MyBookingsPage } from "./pages/MyBookingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TicketPage } from "./pages/TicketPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="mis-reservas" element={<MyBookingsPage />} />
        <Route path=":slug" element={<BusinessPage />} />
        <Route path=":slug/reserva/:token" element={<TicketPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
