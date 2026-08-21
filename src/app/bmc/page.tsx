import { redirect } from "next/navigation";
import { getProfile, landingFor } from "@/lib/bmc/auth";

/** Entry point: route to the right side of the app for the signed-in role. */
export default async function BmcIndexPage() {
  const profile = await getProfile();
  redirect(profile ? landingFor(profile.role) : "/bmc/login");
}
