import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { platformApi } from "./platformApi";
import type {
  ActivityFilters,
  BusinessFilters,
  Member,
  NewMember,
  NewPayment,
  NewPlatformBusiness,
  SubscriptionChanges,
} from "./platformTypes";

// Everything the team sees lives under one key, so after any change a single call refreshes it all.
const ROOT = ["platform"] as const;

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ROOT });
}

export function useDashboard() {
  return useQuery({ queryKey: [...ROOT, "dashboard"], queryFn: platformApi.dashboard, refetchInterval: 60_000 });
}

export function useBusinessList(filters: BusinessFilters) {
  return useInfiniteQuery({
    queryKey: [...ROOT, "businesses", filters],
    queryFn: ({ pageParam }) => platformApi.businesses(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
  });
}

export function useBusiness(slug: string) {
  return useQuery({ queryKey: [...ROOT, "business", slug], queryFn: () => platformApi.business(slug), enabled: slug !== "" });
}

export function useCreateBusiness() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (business: NewPlatformBusiness) => platformApi.createBusiness(business), onSuccess: refresh });
}

export function useSuspend(slug: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (reason: string) => platformApi.suspend(slug, reason), onSuccess: refresh });
}

export function useReactivate(slug: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => platformApi.reactivate(slug), onSuccess: refresh });
}

export function useSaveSubscription(slug: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (changes: SubscriptionChanges) => platformApi.saveSubscription(slug, changes), onSuccess: refresh });
}

export function usePayments(slug: string) {
  return useQuery({ queryKey: [...ROOT, "payments", slug], queryFn: () => platformApi.payments(slug), enabled: slug !== "" });
}

export function useRecordPayment(slug: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (payment: NewPayment) => platformApi.recordPayment(slug, payment), onSuccess: refresh });
}

export function useMembers(slug: string) {
  return useQuery({ queryKey: [...ROOT, "members", slug], queryFn: () => platformApi.members(slug), enabled: slug !== "" });
}

export function useAddMember(slug: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (member: NewMember) => platformApi.addMember(slug, member), onSuccess: refresh });
}

export function useChangeRole(slug: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Member["role"] }) => platformApi.changeRole(slug, id, role),
    onSuccess: refresh,
  });
}

export function useRemoveMember(slug: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: number) => platformApi.removeMember(slug, id), onSuccess: refresh });
}

export function useSendAccessLink(slug: string) {
  return useMutation({ mutationFn: (id: number) => platformApi.sendAccessLink(slug, id) });
}

export function useActivity(filters: ActivityFilters) {
  return useInfiniteQuery({
    queryKey: [...ROOT, "activity", filters],
    queryFn: ({ pageParam }) => platformApi.activity(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
  });
}
