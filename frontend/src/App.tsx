import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { BusinessPage } from "./pages/BusinessPage";
import { HomePage } from "./pages/HomePage";
import { MyBookingsPage } from "./pages/MyBookingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { BlocksPage } from "./pages/panel/BlocksPage";
import { BookingDetailPage } from "./pages/panel/BookingDetailPage";
import { BookingsPage } from "./pages/panel/BookingsPage";
import { CustomerDetailPage } from "./pages/panel/CustomerDetailPage";
import { CustomersPage } from "./pages/panel/CustomersPage";
import { LoginPage } from "./pages/panel/LoginPage";
import { MorePage } from "./pages/panel/MorePage";
import { NewBookingPage } from "./pages/panel/NewBookingPage";
import { PanelHome } from "./pages/panel/PanelHome";
import { PanelLayout } from "./pages/panel/PanelLayout";
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

      <Route path="panel/entrar" element={<LoginPage />} />
      <Route
        path="panel"
        element={
          <RequireAuth>
            <PanelLayout />
          </RequireAuth>
        }
      >
        <Route index element={<PanelHome />} />
        <Route path="reservas" element={<BookingsPage />} />
        <Route path="reservas/nueva" element={<NewBookingPage />} />
        <Route path="reservas/:id" element={<BookingDetailPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="clientes/:id" element={<CustomerDetailPage />} />
        <Route path="bloqueos" element={<BlocksPage />} />
        <Route path="mas" element={<MorePage />} />
      </Route>
    </Routes>
  );
}
