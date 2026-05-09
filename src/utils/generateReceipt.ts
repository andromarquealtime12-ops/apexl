import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCY_SYMBOLS } from "@/types/database";

export async function generateOrderReceipt(orderId: string) {
  // Fetch order
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) throw new Error("Commande introuvable");

  // Items + product names + sellers
  const { data: items } = await supabase
    .from("order_items")
    .select("id, quantity, unit_price, total_price, selected_color, selected_size, seller_id, products(name)")
    .eq("order_id", orderId);

  const sellerIds = [...new Set((items || []).map((i: any) => i.seller_id).filter(Boolean))];
  const buyerId = (order as any).buyer_id;
  const driverId = (order as any).driver_id;
  const userIds = [...new Set([...sellerIds, buyerId, driverId].filter(Boolean))];

  let profilesMap: Record<string, any> = {};
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .in("user_id", userIds as string[]);
    profilesMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
  }

  let shopsMap: Record<string, any> = {};
  if (sellerIds.length) {
    const { data: shops } = await supabase
      .from("seller_applications")
      .select("user_id, shop_name")
      .in("user_id", sellerIds as string[]);
    shopsMap = Object.fromEntries((shops || []).map((s: any) => [s.user_id, s]));
  }

  const symbol = CURRENCY_SYMBOLS[(order as any).currency as keyof typeof CURRENCY_SYMBOLS] || "$";
  const fmt = (n: number) => `${symbol} ${Number(n || 0).toLocaleString()}`;

  const doc = new jsPDF();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Ayiti Marche", 14, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Reçu de commande", 14, 20);
  doc.text(`#${orderId.slice(0, 8).toUpperCase()}`, 196, 20, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 38;

  // Meta
  doc.setFontSize(10);
  const created = new Date((order as any).created_at).toLocaleString("fr-FR");
  doc.text(`Date : ${created}`, 14, y);
  doc.text(`Statut : ${(order as any).status || "-"}`, 14, y + 6);
  doc.text(`Paiement : ${(order as any).payment_method || "wallet"} (${(order as any).payment_status || "-"})`, 14, y + 12);
  y += 20;

  // Buyer
  const buyer = profilesMap[buyerId];
  doc.setFont("helvetica", "bold");
  doc.text("Acheteur", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(buyer?.full_name || "—", 14, y + 5);
  if (buyer?.phone) doc.text(buyer.phone, 14, y + 10);

  // Delivery
  doc.setFont("helvetica", "bold");
  doc.text("Adresse de livraison", 110, y);
  doc.setFont("helvetica", "normal");
  doc.text((order as any).delivery_city || "—", 110, y + 5);
  const addr = doc.splitTextToSize((order as any).delivery_address || "—", 85);
  doc.text(addr, 110, y + 10);

  y += 24;

  // Items table
  const rows = (items || []).map((it: any) => {
    const variant = [it.selected_color, it.selected_size].filter(Boolean).join(" / ");
    const shop = shopsMap[it.seller_id]?.shop_name || "—";
    return [
      `${it.products?.name || "Produit"}${variant ? `\n${variant}` : ""}`,
      shop,
      String(it.quantity),
      fmt(it.unit_price),
      fmt(it.total_price),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Produit", "Boutique", "Qté", "P.U.", "Total"]],
    body: rows,
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Totals
  const subtotal = (items || []).reduce((s: number, i: any) => s + Number(i.total_price || 0), 0);
  const fee = Number((order as any).delivery_fee || 0);
  const total = Number((order as any).total_amount || 0);

  doc.setFontSize(10);
  doc.text("Sous-total :", 140, finalY);
  doc.text(fmt(subtotal), 196, finalY, { align: "right" });
  doc.text("Frais de livraison :", 140, finalY + 6);
  doc.text(fmt(fee), 196, finalY + 6, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL :", 140, finalY + 14);
  doc.text(fmt(total), 196, finalY + 14, { align: "right" });

  // Driver
  if (driverId && profilesMap[driverId]) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Livreur : ${profilesMap[driverId].full_name || "—"}`, 14, finalY + 22);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Merci pour votre achat sur Ayiti Marche — marketayiti.shop", 105, 287, { align: "center" });

  doc.save(`recu-${orderId.slice(0, 8)}.pdf`);
}
