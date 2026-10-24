import { redirect } from "next/navigation";
import PosShell from "@/components/PosShell";
import { hasSession } from "@/lib/guard";

/**
 * The proxy has already bounced most signed-out visitors; this is the check
 * that actually counts, sitting next to the thing it protects.
 */
export default async function PosPage() {
  if (!(await hasSession())) redirect("/login");
  return <PosShell />;
}
