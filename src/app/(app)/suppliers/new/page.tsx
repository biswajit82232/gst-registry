import { redirect } from "next/navigation";

export default function NewSupplierRedirect() {
  redirect("/purchases/new");
}
