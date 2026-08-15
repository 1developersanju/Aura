import { redirect } from "next/navigation";

export default function AdminDonationsRedirect() {
  redirect("/admin/ledger");
}
