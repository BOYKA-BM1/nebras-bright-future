import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useRoles } from "@/hooks/use-roles";

export const Route = createFileRoute("/_authenticated/staff/")({
  component: StaffIndex,
});

function StaffIndex() {
  const { isMontage, isCustomerService, isSecretary, isAdmin, isLoading } = useRoles();
  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (isMontage) return <Navigate to="/staff/montage" />;
  if (isCustomerService) return <Navigate to="/staff/support" />;
  if (isSecretary) return <Navigate to="/staff/students" />;
  if (isAdmin) return <Navigate to="/staff/montage" />;
  return <Navigate to="/" />;
}
