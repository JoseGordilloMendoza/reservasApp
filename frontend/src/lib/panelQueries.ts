import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "./auth";
import { todayKey } from "./dates";
import { panelApi } from "./panelApi";
import type {
  BookingAction,
  BookingFilters,
  BusinessChanges,
  CustomerDetail,
  CustomerFilters,
  NewBlock,
  NewPanelBooking,
  PanelBookingDetail,
  ScheduleRule,
  ServiceInput,
} from "./panelTypes";

/** Every panel query is keyed by the business, so switching business never shows another one's data. */
function useScope() {
  const { membership } = useAuth();
  return membership?.business.slug ?? "";
}

export function usePanelBusiness() {
  const scope = useScope();
  return useQuery({
    queryKey: ["panel", scope, "business"],
    queryFn: panelApi.business,
    enabled: scope !== "",
    staleTime: 60_000,
  });
}

/** Bookings waiting for the owner. Checked often: a customer may have just booked. */
export function usePendingBookings() {
  const scope = useScope();
  const filters: BookingFilters = { status: ["pending"], ordering: "starts_at" };
  return useQuery({
    queryKey: ["panel", scope, "bookings", "pending"],
    queryFn: () => panelApi.bookings(filters),
    enabled: scope !== "",
    refetchInterval: 30_000,
  });
}

export function useTodayBookings(timeZone: string | undefined) {
  const scope = useScope();
  const today = timeZone ? todayKey(timeZone) : "";
  const filters: BookingFilters = {
    status: ["pending", "confirmed", "completed", "no_show"],
    dateFrom: today,
    dateTo: today,
    ordering: "starts_at",
  };
  return useQuery({
    queryKey: ["panel", scope, "bookings", "today", today],
    queryFn: () => panelApi.bookings(filters),
    enabled: scope !== "" && today !== "",
    refetchInterval: 60_000,
  });
}

/** A list that grows page by page. */
export function useBookingList(filters: BookingFilters, enabled = true) {
  const scope = useScope();
  return useInfiniteQuery({
    queryKey: ["panel", scope, "bookings", "list", filters],
    queryFn: ({ pageParam }) => panelApi.bookings(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    enabled: scope !== "" && enabled,
  });
}

export function useBookingDetail(id: number) {
  const scope = useScope();
  return useQuery({
    queryKey: ["panel", scope, "booking", id],
    queryFn: () => panelApi.booking(id),
    enabled: scope !== "" && Number.isFinite(id),
  });
}

/** Confirm, reject, cancel, complete or mark a no-show; every list is refreshed afterwards. */
export function useBookingAction() {
  const scope = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: BookingAction }) => panelApi.act(id, action),
    onSuccess: (updated: PanelBookingDetail) => {
      queryClient.setQueryData(["panel", scope, "booking", updated.id], updated);
    },
    // Whatever the outcome, the server knows best: a rejected action usually means the state moved.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["panel", scope, "bookings"] }),
  });
}

export function useServices() {
  const scope = useScope();
  return useQuery({
    queryKey: ["panel", scope, "services"],
    queryFn: panelApi.services,
    enabled: scope !== "",
    staleTime: 60_000,
  });
}

export function useCreateBooking() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (booking: NewPanelBooking) => panelApi.createBooking(booking),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panel", scope, "bookings"] }),
  });
}

/** The customers of the business, page by page. */
export function useCustomerList(filters: CustomerFilters) {
  const scope = useScope();
  return useInfiniteQuery({
    queryKey: ["panel", scope, "customers", "list", filters],
    queryFn: ({ pageParam }) => panelApi.customers(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    enabled: scope !== "",
  });
}

export function useCustomerDetail(id: number) {
  const scope = useScope();
  return useQuery({
    queryKey: ["panel", scope, "customers", "detail", id],
    queryFn: () => panelApi.customer(id),
    enabled: scope !== "" && Number.isFinite(id),
  });
}

/** Block or unblock a customer. Bookings show the customer too, so they are refreshed as well. */
export function useUpdateCustomer() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...changes }: { id: number; name?: string; email?: string; is_blocked?: boolean }) =>
      panelApi.updateCustomer(id, changes),
    onSuccess: (updated: CustomerDetail) => {
      queryClient.setQueryData(["panel", scope, "customers", "detail", updated.id], updated);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["panel", scope, "customers", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["panel", scope, "bookings"] });
    },
  });
}

export function useResources() {
  const scope = useScope();
  return useQuery({
    queryKey: ["panel", scope, "resources"],
    queryFn: panelApi.resources,
    enabled: scope !== "",
    staleTime: 60_000,
  });
}

/** Upcoming blocks of the business. */
export function useBlocks() {
  const scope = useScope();
  return useQuery({
    queryKey: ["panel", scope, "blocks"],
    queryFn: panelApi.blocks,
    enabled: scope !== "",
  });
}

export function useCreateBlock() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (block: NewBlock) => panelApi.createBlock(block),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panel", scope, "blocks"] }),
  });
}

export function useDeleteBlock() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => panelApi.deleteBlock(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["panel", scope, "blocks"] }),
  });
}

/** Edit the page, contact data, color or options of the business. */
export function useUpdateBusiness() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: BusinessChanges) => panelApi.updateBusiness(changes),
    onSuccess: (updated) => queryClient.setQueryData(["panel", scope, "business"], updated),
  });
}

/** Resources show up inside services and bookings, so those are refreshed with them. */
function useRefreshAfterResourceChange() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["resources", "services", "bookings"].map((key) => queryClient.invalidateQueries({ queryKey: ["panel", scope, key] })),
    );
}

export function useCreateResource() {
  const refresh = useRefreshAfterResourceChange();
  return useMutation({ mutationFn: (name: string) => panelApi.createResource(name), onSuccess: refresh });
}

export function useUpdateResource() {
  const refresh = useRefreshAfterResourceChange();
  return useMutation({
    mutationFn: ({ id, ...changes }: { id: number; name?: string; is_active?: boolean }) => panelApi.updateResource(id, changes),
    onSuccess: refresh,
  });
}

export function useDeleteResource() {
  const refresh = useRefreshAfterResourceChange();
  return useMutation({ mutationFn: (id: number) => panelApi.deleteResource(id), onSuccess: refresh });
}

export function useSchedule(resourceId: number) {
  const scope = useScope();
  return useQuery({
    queryKey: ["panel", scope, "schedule", resourceId],
    queryFn: () => panelApi.schedule(resourceId),
    enabled: scope !== "" && Number.isFinite(resourceId),
  });
}

export function useSaveSchedule(resourceId: number) {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: ScheduleRule[]) => panelApi.saveSchedule(resourceId, rules),
    onSuccess: (saved) => queryClient.setQueryData(["panel", scope, "schedule", resourceId], saved),
  });
}

export function useCreateService() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (service: ServiceInput) => panelApi.createService(service),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panel", scope, "services"] }),
  });
}

export function useUpdateService() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...changes }: ServiceInput & { id: number }) => panelApi.updateService(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panel", scope, "services"] }),
  });
}

export function useDeleteService() {
  const scope = useScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => panelApi.deleteService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panel", scope, "services"] }),
  });
}
