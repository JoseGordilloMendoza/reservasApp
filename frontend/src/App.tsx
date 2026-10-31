import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { RequirePlatform } from "./components/platform/RequirePlatform";
import { RequireAuth } from "./components/RequireAuth";
import { ScrollToTop } from "./components/ScrollToTop";
import { BusinessPage } from "./pages/BusinessPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LoginPage } from "./pages/panel/LoginPage";

// Each of these is downloaded when its screen is first opened, not with the home page.
const MyBookingsPage = lazy(() => import("./pages/MyBookingsPage").then((m) => ({ default: m.MyBookingsPage })));
const BlocksPage = lazy(() => import("./pages/panel/BlocksPage").then((m) => ({ default: m.BlocksPage })));
const BookingDetailPage = lazy(() => import("./pages/panel/BookingDetailPage").then((m) => ({ default: m.BookingDetailPage })));
const BookingsPage = lazy(() => import("./pages/panel/BookingsPage").then((m) => ({ default: m.BookingsPage })));
const BusinessSettingsPage = lazy(() => import("./pages/panel/BusinessSettingsPage").then((m) => ({ default: m.BusinessSettingsPage })));
const CustomerDetailPage = lazy(() => import("./pages/panel/CustomerDetailPage").then((m) => ({ default: m.CustomerDetailPage })));
const CustomersPage = lazy(() => import("./pages/panel/CustomersPage").then((m) => ({ default: m.CustomersPage })));
const MorePage = lazy(() => import("./pages/panel/MorePage").then((m) => ({ default: m.MorePage })));
const NewPasswordPage = lazy(() => import("./pages/panel/NewPasswordPage").then((m) => ({ default: m.NewPasswordPage })));
const NewBookingPage = lazy(() => import("./pages/panel/NewBookingPage").then((m) => ({ default: m.NewBookingPage })));
const PanelHome = lazy(() => import("./pages/panel/PanelHome").then((m) => ({ default: m.PanelHome })));
const PanelLayout = lazy(() => import("./pages/panel/PanelLayout").then((m) => ({ default: m.PanelLayout })));
const RecoverPasswordPage = lazy(() => import("./pages/panel/RecoverPasswordPage").then((m) => ({ default: m.RecoverPasswordPage })));
const RulesSettingsPage = lazy(() => import("./pages/panel/RulesSettingsPage").then((m) => ({ default: m.RulesSettingsPage })));
const SchedulePage = lazy(() => import("./pages/panel/SchedulePage").then((m) => ({ default: m.SchedulePage })));
const ServicesPage = lazy(() => import("./pages/panel/ServicesPage").then((m) => ({ default: m.ServicesPage })));
const SettingsPage = lazy(() => import("./pages/panel/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const SpacesPage = lazy(() => import("./pages/panel/SpacesPage").then((m) => ({ default: m.SpacesPage })));
const ActivityPage = lazy(() => import("./pages/platform/ActivityPage").then((m) => ({ default: m.ActivityPage })));
const BusinessAdminPage = lazy(() => import("./pages/platform/BusinessAdminPage").then((m) => ({ default: m.BusinessAdminPage })));
const BusinessesPage = lazy(() => import("./pages/platform/BusinessesPage").then((m) => ({ default: m.BusinessesPage })));
const NewBusinessPage = lazy(() => import("./pages/platform/NewBusinessPage").then((m) => ({ default: m.NewBusinessPage })));
const PlatformHome = lazy(() => import("./pages/platform/PlatformHome").then((m) => ({ default: m.PlatformHome })));
const PlatformLayout = lazy(() => import("./pages/platform/PlatformLayout").then((m) => ({ default: m.PlatformLayout })));
const TicketPage = lazy(() => import("./pages/TicketPage").then((m) => ({ default: m.TicketPage })));

export function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div aria-busy="true" aria-label="Cargando" className="min-h-dvh" />}>
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="mis-reservas" element={<MyBookingsPage />} />
        <Route path=":slug" element={<BusinessPage />} />
        <Route path=":slug/reserva/:token" element={<TicketPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="plataforma"
        element={
          <RequirePlatform>
            <PlatformLayout />
          </RequirePlatform>
        }
      >
        <Route index element={<PlatformHome />} />
        <Route path="negocios" element={<BusinessesPage />} />
        <Route path="negocios/nuevo" element={<NewBusinessPage />} />
        <Route path="negocios/:slug" element={<BusinessAdminPage />} />
        <Route path="actividad" element={<ActivityPage />} />
      </Route>

      <Route path="panel/entrar" element={<LoginPage />} />
      <Route path="panel/recuperar" element={<RecoverPasswordPage />} />
      <Route path="panel/nueva-contrasena" element={<NewPasswordPage />} />
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
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="ajustes/negocio" element={<BusinessSettingsPage />} />
        <Route path="ajustes/reglas" element={<RulesSettingsPage />} />
        <Route path="ajustes/espacios" element={<SpacesPage />} />
        <Route path="ajustes/espacios/:id/horario" element={<SchedulePage />} />
        <Route path="ajustes/servicios" element={<ServicesPage />} />
        <Route path="mas" element={<MorePage />} />
      </Route>
      </Routes>
      </Suspense>
    </>
  );
}
