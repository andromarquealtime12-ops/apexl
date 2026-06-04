import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCY_SYMBOLS } from "@/types/database";

async function fetchOrderBundle(orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Commande introuvable");

  const { data: items } = await supabase
    .from("order_items")
    .select("id, quantity, unit_price, total_price, selected_color, selected_size, seller_id, products(name)")
    .eq("order_id", orderId);

  const sellerIds = [...new Set((items || []).map((i: any) => i.seller_id).filter(Boolean))];
  const buyerId = (order as any).buyer_id;
  const driverId = (order as any).driver_id;
  const userIds = [...new Set([...sellerIds, buyerId, driverId].filter(Boolean))] as string[];

  let profilesMap: Record<string, any> = {};
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
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

  return { order: order as any, items: (items || []) as any[], profilesMap, shopsMap, buyerId, driverId };
}

function symbolFor(currency: string) {
  return CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || "$";
}

function renderOrderSection(doc: jsPDF, bundle: Awaited<ReturnType<typeof fetchOrderBundle>>, startY: number) {
  const { order, items, profilesMap, shopsMap, buyerId, driverId } = bundle;
  const symbol = symbolFor(order.currency);
  const fmt = (n: number) => `${symbol} ${Number(n || 0).toLocaleString()}`;

  let y = startY;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Commande #${String(order.id).slice(0, 8).toUpperCase()}`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const created = new Date(order.created_at).toLocaleString("fr-FR");
  doc.text(`Date: ${created}  •  Statut: ${order.status || "-"}  •  Paiement: ${order.payment_method || "wallet"} (${order.payment_status || "-"})`, 14, y + 5);

  const buyer = profilesMap[buyerId];
  doc.text(`Acheteur: ${buyer?.full_name || "—"}${buyer?.phone ? ` (${buyer.phone})` : ""}`, 14, y + 11);
  doc.text(`Livraison: ${order.delivery_city || "—"} — ${order.delivery_address || "—"}`, 14, y + 16);
  y += 20;

  const rows = items.map((it) => {
    const variant = [it.selected_color, it.selected_size].filter(Boolean).join(" / ");
    const shop = shopsMap[it.seller_id]?.shop_name || "—";
    return [
      `${it.products?.name || "Produit"}${variant ? `\n${variant}` : ""}`,
      shop,
      String(it.quantity || 0),
      fmt(it.unit_price),
      fmt(it.total_price),
    ];
  });

  if (rows.length === 0) {
    rows.push(["(aucun article)", "—", "0", fmt(0), fmt(0)]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Produit", "Boutique", "Qté", "P.U.", "Total"]],
    body: rows,
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 10;
  const subtotal = items.reduce((s, i) => s + Number(i.total_price || 0), 0);
  const fee = Number(order.delivery_fee || 0);
  const total = Number(order.total_amount || 0);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Sous-total: ${fmt(subtotal)}   Livraison: ${fmt(fee)}`, 14, finalY + 6);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${fmt(total)}`, 196, finalY + 6, { align: "right" });

  if (driverId && profilesMap[driverId]) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Livreur: ${profilesMap[driverId].full_name || "—"}`, 14, finalY + 12);
  }

  return { finalY: finalY + 16, total, currency: order.currency as string };
}

function drawHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Ayiti Marche", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 19);
  if (subtitle) doc.text(subtitle, 196, 19, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function drawFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Ayiti Marche — marketayiti.shop  •  Page ${i}/${pages}`, 105, 290, { align: "center" });
  }
}

export async function generateOrderReceipt(orderId: string) {
  try {
    const bundle = await fetchOrderBundle(orderId);
    const doc = new jsPDF();
    drawHeader(doc, "Reçu de commande", `#${orderId.slice(0, 8).toUpperCase()}`);
    renderOrderSection(doc, bundle, 34);
    drawFooter(doc);
    doc.save(`recu-${orderId.slice(0, 8)}.pdf`);
  } catch (e: any) {
    console.error("generateOrderReceipt error:", e);
    throw new Error(e?.message || "Erreur lors de la génération du reçu");
  }
}

export async function generateConsolidatedReceipts(params: {
  fromISO: string;
  toISO: string;
  buyerId?: string;
}) {
  const { fromISO, toISO, buyerId } = params;
  let q = supabase
    .from("orders")
    .select("id")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: true });
  if (buyerId) q = q.eq("buyer_id", buyerId);

  const { data: list, error } = await q;
  if (error) throw new Error(error.message);
  if (!list || list.length === 0) throw new Error("Aucune commande sur cette période");

  const doc = new jsPDF();
  const fromLbl = new Date(fromISO).toLocaleDateString("fr-FR");
  const toLbl = new Date(toISO).toLocaleDateString("fr-FR");
  drawHeader(doc, "Reçu consolidé", `${fromLbl} → ${toLbl}`);

  let y = 34;
  doc.setFontSize(10);
  doc.text(`Commandes: ${list.length}`, 14, y);
  y += 8;

  const totals: Record<string, number> = {};
  for (let i = 0; i < list.length; i++) {
    const id = (list[i] as any).id;
    const bundle = await fetchOrderBundle(id);
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    const r = renderOrderSection(doc, bundle, y);
    totals[r.currency] = (totals[r.currency] || 0) + r.total;
    y = r.finalY + 4;
    if (i < list.length - 1) {
      doc.setDrawColor(220);
      doc.line(14, y, 196, y);
      y += 6;
    }
  }

  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total global", 14, y + 8);
  let ty = y + 14;
  for (const [cur, amount] of Object.entries(totals)) {
    const sym = symbolFor(cur);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${cur}: ${sym} ${amount.toLocaleString()}`, 14, ty);
    ty += 6;
  }

  drawFooter(doc);
  doc.save(`recu-consolide-${fromISO.slice(0, 10)}_${toISO.slice(0, 10)}.pdf`);
}
