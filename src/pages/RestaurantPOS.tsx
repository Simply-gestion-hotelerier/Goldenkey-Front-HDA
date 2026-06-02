// ============================================================
// RESTAURANT POS - VERSION CORRIGÉE (comme CasinoPOS)
// Numéro de facture fixe + bouton MOINS + paiements partiels
// ============================================================

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/rbac";
import {
  ClipboardList, Utensils, Edit2, Trash2, PlusSquare, Search,
  Clock, RefreshCw, MessageSquare, Printer, FileText,
  CheckCircle2, XCircle, ChevronDown, ChevronRight,
  ChevronLeft, Info, Hash, Tag, Percent, X, CreditCard,
  Users, Dices, Plus, CheckCheck, Minus, User,
} from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { WaiterAssignment } from "./WaiterAssignment";

// ── Helpers numbers ────────────────────────────────────────────────────────────

// Génère un numéro de facture unique (comme CasinoPOS)
const generateInvoiceNumber = (orderId?: number) => {
  if (orderId) {
    const saved = localStorage.getItem(`restaurant_invoice_${orderId}`);
    if (saved) return saved;
  }
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code5 = "";
  for (let i = 0; i < 5; i++) code5 += letters.charAt(Math.floor(Math.random() * letters.length));
  const newInvoice = `INV-${code5}`;
  if (orderId) {
    localStorage.setItem(`restaurant_invoice_${orderId}`, newInvoice);
  }
  return newInvoice;
};

const formatOrderNumber = (orderId: number, createdAt?: string) => {
  if (!createdAt) return `ORD-${String(orderId).padStart(6, "0")}`;
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `ORD-${year}${month}${day}-${String(orderId).padStart(4, "0")}`;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "beverage", label: "Boissons" },
  { key: "breakfast", label: "Petit-déjeuner" },
  { key: "appetizer", label: "Apéritifs" },
  { key: "main_course", label: "Plats principaux" },
  { key: "side_dish", label: "Accompagnements" },
  { key: "dessert", label: "Desserts" },
  { key: "snack", label: "Snacks" },
];

const CATEGORY_ORDER = [
  "beverage", "breakfast", "appetizer", "main_course", "side_dish", "dessert", "snack",
];

const getIndex = (cat?: string) => {
  const i = CATEGORY_ORDER.indexOf(cat || "");
  return i === -1 ? 999 : i;
};

const FIRE_STYLE: Record<string, string> = {
  commanded: "bg-yellow-100 text-yellow-800 border-yellow-200",
  preparing: "bg-blue-100 text-blue-800 border-blue-200",
  ready: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  voided: "bg-red-100 text-red-800 border-red-200",
};

const FIRE_LABEL: Record<string, string> = {
  commanded: "Commandé", preparing: "Préparation", ready: "Prêt", delivered: "Livré", voided: "Annulé",
};

const FIRE_ICON: Record<string, string> = {
  commanded: "⏳", preparing: "🔥", ready: "✅", delivered: "🍽", voided: "❌",
};

function FireBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border font-medium ${FIRE_STYLE[status] ?? "bg-muted text-muted-foreground"}`}>
      <span>{FIRE_ICON[status] ?? "?"}</span>{FIRE_LABEL[status] ?? status}
    </span>
  );
}

// ── Restaurant info ───────────────────────────────────────────────────────────

const RESTAURANT = {
  name: "Hôtel de l'Avenue — Restaurant",
  address: "Antsirabe, Madagascar",
  phone: "+261 038 33 188 31",
};

const W = 42;
const sep = "=".repeat(W);
const dsh = "-".repeat(W);

function ctr(s: string, w: number) {
  const p = Math.max(0, w - s.length);
  return " ".repeat(Math.floor(p / 2)) + s;
}
function padL(lbl: string, val: string, w: number) {
  const gap = Math.max(1, w - lbl.length - val.length);
  return lbl + " ".repeat(gap) + val;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const METHOD_LBL: Record<string, string> = {
  cash: "Espèces",
  card: "Carte bancaire",
  mobile: "Mobile Money",
  voucher: "Ticket restaurant",
  bank: "Virement",
};

function operatorLabel(p: any): string | null {
  return p?.operator?.name ?? p?.operator?.email ?? p?.operatorName ?? null;
}

// ── ORDER CALCULATIONS ───────────────────────────────────────────────────────────

const orderSubtotal = (o: any): number =>
  (o.lines ?? []).reduce((s: number, l: any) => s + l.unitPrice * l.qty, 0);

const orderDiscount = (o: any): number =>
  Math.max(0, o.discountAmount ?? 0);

const orderTotal = (o: any): number =>
  Math.max(0, orderSubtotal(o) - orderDiscount(o));

const orderPaid = (o: any): number =>
  (o.payments ?? []).reduce((s: number, p: any) => s + p.amount, 0);

const orderBalance = (o: any): number =>
  Math.max(0, orderTotal(o) - orderPaid(o));

// ── CARD FEES ─────────────────────────────────────────────────────────────────
const CARD_FEE_RATE = 0.05;

const computeCardFees = (payments: any[]): { cardAmount: number; fees: number; totalDebited: number } => {
  const cardTotal = payments
    .filter((p: any) => p.method === "card")
    .reduce((s: number, p: any) => s + p.amount, 0);
  const fees = Math.round(cardTotal * CARD_FEE_RATE);
  return { cardAmount: cardTotal, fees, totalDebited: cardTotal + fees };
};

// ── PRINT 80mm ────────────────────────────────────────────────────────────────

function print80mm(tableCode: string, order: any) {
  const win = window.open("", "_blank");
  if (!win) return;

  const payments: any[] = order.payments ?? [];
  const subtotal = orderSubtotal(order);
  const discount = orderDiscount(order);
  const total = orderTotal(order);
  const paid = payments.reduce((s: number, p: any) => s + p.amount, 0);
  const bal = Math.max(0, total - paid);

  const { cardAmount, fees: bankFees, totalDebited } = computeCardFees(payments);

  const orderNumber = order.orderNumber || formatOrderNumber(order.id, order.createdAt);
  const invoiceNumber = order.invoiceNumber || generateInvoiceNumber(order.id);

  const lines: string[] = [
    ctr(RESTAURANT.name, W),
    ctr(RESTAURANT.address, W),
    ctr(RESTAURANT.phone, W),
    sep,
    ctr("** COMMANDE / FACTURE **", W),
    sep,
    padL("N° commande :", orderNumber, W),
    padL("N° facture  :", invoiceNumber, W),
    padL("Table       :", tableCode, W),
    padL("Commande    :", `#${order.id}`, W),
    padL("Date        :", new Date().toLocaleDateString("fr-FR"), W),
    padL("Heure       :", new Date().toLocaleTimeString("fr-FR"), W),
    sep,
    ctr("-- ARTICLES --", W),
    dsh,
  ];

  (order.lines ?? []).forEach((l: any) => {
    lines.push(
      padL(
        (l.itemName ?? "").substring(0, 20) + ` x${l.qty}`,
        fmt(l.unitPrice * l.qty) + " Ar",
        W
      )
    );
    if (l.comment) lines.push(`  > ${l.comment.substring(0, W - 4)}`);
  });

  lines.push(dsh);
  lines.push(padL("SOUS-TOTAL", fmt(subtotal) + " Ar", W));

  if (discount > 0) {
    const discLabel = order.discountReason
      ? `REMISE (${order.discountReason.substring(0, 12)})`
      : "REMISE";
    lines.push(padL(discLabel, `-${fmt(discount)} Ar`, W));
    lines.push(dsh);
    lines.push(padL("TOTAL TTC", fmt(total) + " Ar", W));
  }

  if (payments.length > 0) {
    lines.push(ctr("-- PAIEMENTS --", W));
    payments.forEach((p: any) => {
      lines.push(padL(METHOD_LBL[p.method] ?? p.method, `${fmt(p.amount)} Ar`, W));

      if (p.receivedAmount && p.receivedAmount > p.amount) {
        lines.push(padL("  Reçu        :", fmt(p.receivedAmount) + " Ar", W));
        lines.push(padL("  Monnaie     :", fmt(p.receivedAmount - p.amount) + " Ar", W));
      }
      const op = operatorLabel(p);
      if (op) lines.push(`  Opérateur : ${op.substring(0, 22)}`);
    });
    lines.push(dsh);
  }

  if (bal > 0) {
    lines.push(padL("RESTE À PAYER", fmt(bal) + " Ar", W));
  } else if (paid > total) {
    const credit = paid - total;
    lines.push(padL("CRÉDIT CLIENT", fmt(credit) + " Ar", W));
  } else {
    lines.push(padL("PAYÉ", "0 Ar", W));
  }
  lines.push(sep);

  if (cardAmount > 0) {
    lines.push("");
    lines.push(ctr("** INFORMATIONS FRAIS BANCAIRES **", W));
    lines.push(dsh);
    lines.push(padL("Montant consommé :", fmt(cardAmount) + " Ar", W));
    lines.push(padL("Frais bancaires (5%) :", fmt(bankFees) + " Ar", W));
    lines.push(dsh);
    lines.push(padL("TOTAL DÉBITÉ CARTE :", fmt(totalDebited) + " Ar", W));
    lines.push(ctr("(frais retenus par la banque)", W));
    lines.push(dsh);
  }

  lines.push("");
  lines.push(ctr("Merci de votre visite !", W));
  lines.push(ctr("Hôtel de l'Avenue", W));
  lines.push(ctr(new Date().toLocaleString("fr-FR"), W));
  lines.push("");

  win.document.write(
    `<html><head><meta charset="utf-8"/>
    <style>@page{size:80mm auto;margin:2mm 3mm}body{font-family:'Courier New',monospace;font-size:11px;line-height:1.5;white-space:pre}</style>
    </head><body>${esc(lines.join("\n"))}</body></html>`
  );
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

// ── PRINT A4 ──────────────────────────────────────────────────────────────────

function printA4(tableCode: string, order: any) {
  const win = window.open("", "_blank");
  if (!win) return;

  const payments: any[] = order.payments ?? [];
  const subtotal = orderSubtotal(order);
  const discount = orderDiscount(order);
  const total = orderTotal(order);
  const paid = payments.reduce((s: number, p: any) => s + p.amount, 0);
  const balance = Math.max(0, total - paid);
  const credit = paid > total ? paid - total : 0;

  const { cardAmount, fees: bankFees, totalDebited } = computeCardFees(payments);

  const orderNumber = order.orderNumber || formatOrderNumber(order.id, order.createdAt);
  const invoiceNumber = order.invoiceNumber || generateInvoiceNumber(order.id);

  const rows = (order.lines ?? [])
    .map(
      (l: any) => `
    </table>
       <td style="padding:8px;">
         <strong>${l.itemName ?? ""}</strong>
         ${l.comment ? `<br/><small style="color:#6b7280;font-style:italic">↳ ${l.comment}</small>` : ""}
        </td>
       <td style="text-align:right;padding:8px;">${fmt(l.unitPrice)} Ar</td>
       <td style="text-align:center;padding:8px;">${l.qty}</td>
       <td style="text-align:right;padding:8px;font-weight:600">${fmt(l.unitPrice * l.qty)} Ar</td>
      </tr>`
    )
    .join("");

  const payRows = payments
    .map((p: any) => {
      const change = p.receivedAmount ? Math.max(0, p.receivedAmount - p.amount) : 0;
      const op = operatorLabel(p);
      const pFees = p.method === "card" ? Math.round(p.amount * CARD_FEE_RATE) : 0;
      return `
    <tr>
      <td colspan="3" style="padding:8px;color:#059669">
        💳 ${METHOD_LBL[p.method] ?? p.method} — ${new Date(p.receivedAt).toLocaleDateString("fr-FR")}
        ${p.method === "card" ? `
            <br/><small style="color:#6b7280">Montant consommé collecté : <strong>${fmt(p.amount)} Ar</strong></small>
            <br/><small style="color:#dc2626">+ Frais bancaires (5%) : <strong>+${fmt(pFees)} Ar</strong> <em>(retenus par la banque)</em></small>
            <br/><small style="color:#1d4ed8;font-weight:700">→ Total débité de votre carte : ${fmt(p.amount + pFees)} Ar</small>
          ` : ""}
        ${p.receivedAmount && p.receivedAmount > p.amount
          ? `<br/><small style="color:#6b7280">Reçu : ${fmt(p.receivedAmount)} Ar &nbsp;|&nbsp; Monnaie rendue : ${fmt(change)} Ar</small>`
          : ""}
        ${op ? `<br/><small style="color:#7c3aed;font-weight:600">👤 Opérateur : ${op}</small>` : ""}
        </td>
      <td style="text-align:right;padding:8px;color:#059669;font-weight:600">-${fmt(p.amount)} Ar</td>
     </tr>`
    })
    .join("");

  const discountRow =
    discount > 0
      ? `<tr>
          <td colspan="3" style="text-align:right;padding:8px;color:#b45309">
            Remise${order.discountReason ? ` — ${order.discountReason}` : ""}
            ${order.discountType === "percent" ? ` (${Math.round((discount / subtotal) * 100)}%)` : ""}
            </td>
          <td style="text-align:right;padding:8px;color:#b45309;font-weight:700">-${fmt(discount)} Ar</td>
        </tr>`
      : "";

  const cardFeesSummaryBlock = cardAmount > 0
    ? `<div class="card-fees-summary">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;">💳</span>
          <strong style="color:#1e40af;font-size:14px;">Récapitulatif paiement carte bancaire</strong>
        </div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #bfdbfe;">
            <td style="padding:6px 0;color:#374151;">Montant consommé</td>
            <td style="text-align:right;padding:6px 0;font-weight:600;">${fmt(cardAmount)} Ar</td>
          </tr>
          <tr style="border-bottom:1px solid #bfdbfe;">
            <td style="padding:6px 0;color:#dc2626;">Frais bancaires (5%) <em style="font-weight:400;color:#6b7280;">— retenus par la banque</em></td>
            <td style="text-align:right;padding:6px 0;color:#dc2626;font-weight:600;">+${fmt(bankFees)} Ar</td>
          </tr>
          <tr style="background:#dbeafe;">
            <td style="padding:8px;font-weight:700;color:#1e40af;border-radius:4px 0 0 4px;">TOTAL DÉBITÉ DE VOTRE CARTE</td>
            <td style="text-align:right;padding:8px;font-weight:700;color:#1e40af;border-radius:0 4px 4px 0;">${fmt(totalDebited)} Ar</td>
          </tr>
        </table>
        <p style="margin-top:8px;font-size:10px;color:#6b7280;font-style:italic;">
          * L'établissement ne collecte que votre montant consommé (${fmt(cardAmount)} Ar). 
          Les ${fmt(bankFees)} Ar de frais sont directement retenus par votre banque.
        </p>
      </div>`
    : "";

  win.document.write(`<html><head><meta charset="utf-8"/>
    <style>
      @page { size: A4; margin: 20mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', sans-serif; color: #111; font-size: 13px; }
      .header { display: flex; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0f2744; }
      .resto-name { font-size: 22px; font-weight: 700; color: #0f2744; }
      .resto-details { font-size: 11px; color: #6b7280; margin-top: 4px; }
      .invoice-info { text-align: right; font-size: 12px; color: #6b7280; }
      .doc-numbers { background: #f8f9fc; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 12px; }
      .doc-numbers strong { color: #0f2744; }
      .info-card { background: #f8f9fc; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; gap: 32px; flex-wrap: wrap; }
      .info-item { font-size: 13px; }
      .info-item strong { color: #0f2744; margin-right: 8px; }
      .card-fees-summary { background: #eff6ff; border: 2px solid #3b82f6; border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      thead th { background: #0f2744; color: #fff; padding: 10px; font-size: 12px; text-align: left; }
      thead th:nth-child(2), thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
      thead th:nth-child(3) { text-align: center; }
      tbody td { padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
      tbody td:nth-child(2), tbody td:nth-child(4) { text-align: right; }
      tbody td:nth-child(3) { text-align: center; }
      tfoot td { font-weight: 700; border-top: 2px solid #0f2744; padding: 10px; }
      tfoot td:not(:first-child) { text-align: right; }
      .discount-banner { background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;margin:8px 0;font-size:12px;color:#92400e;display:flex;justify-content:space-between; }
      .balance { padding: 16px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 14px; margin: 16px 0; }
      .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; line-height: 1.8; }
    </style>
    </head><body>

    <div class="header">
      <div>
        <div class="resto-name">${RESTAURANT.name}</div>
        <div class="resto-details">${RESTAURANT.address}<br/>${RESTAURANT.phone}</div>
      </div>
      <div class="invoice-info">
        <div style="font-size:18px;font-weight:700;color:#0f2744;">FACTURE</div>
        <div>N° ${invoiceNumber}</div>
      </div>
    </div>

    <div class="doc-numbers">
      <span><strong>N° commande</strong> ${orderNumber}</span>
      <span><strong>Commande interne</strong> #${order.id}</span>
    </div>

    <div class="info-card">
      <div class="info-item"><strong>Table :</strong> ${tableCode}</div>
      <div class="info-item"><strong>Date :</strong> ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</div>
      <div class="info-item"><strong>Heure :</strong> ${new Date().toLocaleTimeString("fr-FR")}</div>
      <div class="info-item"><strong>Service :</strong> ${order.serviceType ?? "Sur place"}</div>
      <div class="info-item"><strong>Serveur :</strong> ${operatorLabel(order.payments?.[0]) ?? "—"}</div>
    </div>

    ${discount > 0
      ? `<div class="discount-banner">
             <span>🏷️ Remise appliquée${order.discountReason ? ` : ${order.discountReason}` : ""}${order.discountType === "percent" ? ` (${Math.round((discount / subtotal) * 100)}%)` : ""}</span>
             <strong>-${fmt(discount)} Ar</strong>
           </div>`
      : ""}

    <table>
      <thead>
        <tr>
          <th>Article</th>
          <th style="text-align:right">Prix unitaire</th>
          <th style="text-align:center">Qté</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${payRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right;font-weight:400;border-top:1px solid #e5e7eb">Sous-total</td>
          <td style="text-align:right;font-weight:400;border-top:1px solid #e5e7eb">${fmt(subtotal)} Ar</td>
        </tr>
        ${discountRow}
        <tr>
          <td colspan="3" style="text-align:right">TOTAL TTC</td>
          <td style="text-align:right">${fmt(total)} Ar</td>
        </tr>
        ${paid > 0
      ? `<tr>
                <td colspan="3" style="text-align:right;color:#059669">TOTAL COLLECTÉ</td>
                <td style="text-align:right;color:#059669">-${fmt(paid)} Ar</td>
              </tr>`
      : ""}
      </tfoot>
    </table>

    <div class="balance" style="background:${balance > 0 ? "#fee2e2" : credit > 0 ? "#fef3c7" : "#d1fae5"};color:${balance > 0 ? "#991b1b" : credit > 0 ? "#92400e" : "#065f46"}">
      ${balance > 0 
        ? `⚠️ RESTE À PAYER : ${fmt(balance)} Ar`
        : credit > 0 
          ? `💰 CRÉDIT CLIENT : ${fmt(credit)} Ar<br/><span style="font-size:10px;font-weight:normal;">(à déduire sur la prochaine commande)</span>`
          : "✓ SOLDE PAYÉ"
      }
    </div>

    ${cardFeesSummaryBlock}

    <div class="footer">
      ${RESTAURANT.name}<br/>
      Imprimé le ${new Date().toLocaleString("fr-FR")} — Document non valide sans signature
    </div>

    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

// ── CardFeesInfoBanner ────────────────────────────────────────────────────────

function CardFeesInfoBanner({ cardAmount }: { cardAmount: number }) {
  if (cardAmount <= 0) return null;
  const fees = Math.round(cardAmount * CARD_FEE_RATE);
  const totalDebited = cardAmount + fees;

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
        <CreditCard className="h-4 w-4 shrink-0" />
        Informations frais bancaires
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white rounded border border-blue-100 p-2 text-center">
          <div className="text-muted-foreground">Consommation</div>
          <div className="font-semibold text-foreground mt-0.5">{fmt(cardAmount)} Ar</div>
          <div className="text-xs text-green-600 mt-0.5">collectée</div>
        </div>
        <div className="bg-white rounded border border-red-100 p-2 text-center">
          <div className="text-muted-foreground">Frais bancaires (5%)</div>
          <div className="font-semibold text-red-600 mt-0.5">+{fmt(fees)} Ar</div>
          <div className="text-xs text-muted-foreground mt-0.5">retenus par la banque</div>
        </div>
        <div className="bg-blue-100 rounded border border-blue-200 p-2 text-center">
          <div className="text-blue-700">Total débité</div>
          <div className="font-bold text-blue-800 mt-0.5">{fmt(totalDebited)} Ar</div>
          <div className="text-xs text-blue-600 mt-0.5">de la carte</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">
        L'établissement ne collecte que ${fmt(cardAmount)} Ar. Les ${fmt(fees)} Ar de frais sont directement retenus par votre banque.
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function RestaurantPOS() {
  const { hasScope } = useAuth();
  const qc = useQueryClient();

  // UI State
  const [table, setTable] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingItem, setAddingItem] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"pos" | "waiters">("pos");
  const [newTableCode, setNewTableCode] = useState("");
  const [editingTable, setEditingTable] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [commentDialog, setCommentDialog] = useState<{ dishId: number; dishName: string; dishPrice: number } | null>(null);
  const [detailDialog, setDetailDialog] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<number | "">("");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "mobile" | "bank">("cash");

  const [discountInput, setDiscountInput] = useState<number | "">("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountReason, setDiscountReason] = useState("");
  const [showDiscountForm, setShowDiscountForm] = useState(false);

  const qo = { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 };

  const discountPreviewAr = useMemo(() => {
    if (!selectedOrder || discountInput === "") return 0;
    const sub = orderSubtotal(selectedOrder);
    return discountType === "percent"
      ? Math.round((Number(discountInput) / 100) * sub)
      : Number(discountInput);
  }, [discountInput, discountType, selectedOrder]);

  const currentCardFees = useMemo(() => {
    if (!selectedOrder) return { cardAmount: 0, fees: 0, totalDebited: 0 };
    return computeCardFees(selectedOrder.payments ?? []);
  }, [selectedOrder]);

  const nextCardFeePreview = useMemo(() => {
    if (payMethod !== "card" || !receivedAmount || Number(receivedAmount) <= 0) return 0;
    return Math.round(Number(receivedAmount) * CARD_FEE_RATE);
  }, [payMethod, receivedAmount]);

  // Queries
  const { data: tables = [] } = useQuery({
    queryKey: ["restaurant", "tables"],
    queryFn: () => api.get<any[]>("/restaurant/tables"),
    ...qo,
  });

  useEffect(() => {
    if ((tables as any[]).length && !table) setTable((tables as any[])[0].code);
  }, [tables]);

  const { data: dishes = [], isLoading: dishesLoading, error: dishesError } = useQuery({
    queryKey: ["dishes"],
    queryFn: async () => {
      const r = await api.get<any>("/dishes");
      return Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
    },
    ...qo,
  });

  const { data: allOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ["orders", "restaurant"],
    queryFn: () => api.get<any[]>("/restaurant/orders?status=open"),
    ...qo,
  });

  // Derived
  const tableOrders = useMemo(
    () => (allOrders as any[]).filter((o: any) => o.table?.code === table),
    [allOrders, table]
  );

  const getTableOrders = (code: string) =>
    (allOrders as any[]).filter((o: any) => o.table?.code === code && o.status === "open");

  const filteredDishes = useMemo(() => {
    if (!Array.isArray(dishes)) return [];
    if (!searchTerm) return dishes as any[];
    const q = searchTerm.toLowerCase();
    return (dishes as any[]).filter(
      (d: any) =>
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q)
    );
  }, [dishes, searchTerm]);

  // Mutations
  const createTable = useMutation({
    mutationFn: (code: string) => api.post("/restaurant/tables", { code, department: "restaurant" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", "tables"] });
      setNewTableCode("");
      toast({ title: "Table créée" });
    },
  });

  const editTableMut = useMutation({
    mutationFn: (p: { id: number; code: string }) =>
      api.patch(`/restaurant/tables/${p.id}`, { code: p.code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", "tables"] });
      setEditingTable(null);
      toast({ title: "Table modifiée" });
    },
  });

  const removeTable = useMutation({
    mutationFn: (id: number) => api.del(`/restaurant/tables/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", "tables"] });
      toast({ title: "Table supprimée" });
    },
    onError: (e: any) =>
      toast({ title: "Impossible de supprimer la table", description: e.response?.data?.error ?? String(e), variant: "destructive" }),
  });

  const createOrder = useMutation({
    mutationFn: async (tableCode: string) => {
      const invoiceNumber = generateInvoiceNumber();
      return api.post("/restaurant/orders", { dept: "restaurant", tableCode, invoiceNumber });
    },
    onSuccess: (response) => {
      if (response?.id && response?.invoiceNumber) {
        localStorage.setItem(`restaurant_invoice_${response.id}`, response.invoiceNumber);
      }
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
    },
  });

  const addLine = useMutation({
    mutationFn: (p: { orderId: number; itemId: number; comment?: string }) =>
      api.post(`/restaurant/orders/${p.orderId}/lines`, {
        itemId: Number(p.itemId), qty: 1, comment: p.comment ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
      toast({ title: "Article ajouté" });
    },
    onError: (e: any) =>
      toast({ title: "Erreur d'ajout", description: e.response?.data?.message ?? String(e), variant: "destructive" }),
  });

  const deleteOrderLine = useMutation({
    mutationFn: async ({ orderId, lineId }: { orderId: number; lineId: number }) =>
      api.del(`/restaurant/orders/${orderId}/lines/${lineId}`),
    onSuccess: async (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
      await refetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) await refreshSelectedOrder(orderId);
      toast({ title: "Article supprimé" });
    },
    onError: (e: any) =>
      toast({ title: "Erreur de suppression", description: e.response?.data?.error ?? String(e), variant: "destructive" }),
  });

  const incrementLine = useMutation({
    mutationFn: ({ orderId, lineId, currentQty }: { orderId: number; lineId: number; currentQty: number }) =>
      api.patch(`/restaurant/orders/${orderId}/lines/${lineId}`, { qty: currentQty + 1 }),
    onSuccess: async (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
      await refetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) await refreshSelectedOrder(orderId);
      toast({ title: "Quantité augmentée" });
    },
    onError: (e: any) =>
      toast({ title: "Erreur", description: e.response?.data?.error ?? String(e), variant: "destructive" }),
  });

  // Mutation pour diminuer la quantité (bouton MOINS)
  const decrementLine = useMutation({
    mutationFn: ({ orderId, lineId, currentQty }: { orderId: number; lineId: number; currentQty: number }) => {
      if (currentQty <= 1) {
        return api.del(`/restaurant/orders/${orderId}/lines/${lineId}`);
      }
      return api.patch(`/restaurant/orders/${orderId}/lines/${lineId}`, { qty: currentQty - 1 });
    },
    onSuccess: async (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
      await refetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) await refreshSelectedOrder(orderId);
      toast({ title: "Quantité diminuée" });
    },
    onError: (e: any) =>
      toast({ title: "Erreur", description: e.response?.data?.error ?? String(e), variant: "destructive" }),
  });

  const handleDeleteLine = (orderId: number, lineId: number, itemName: string) => {
    if (confirm(`Supprimer "${itemName}" de cette commande ?`))
      deleteOrderLine.mutate({ orderId, lineId });
  };

  const closeOrder = useMutation({
    mutationFn: async (id: number) => api.post(`/restaurant/orders/${id}/close`),
    onSuccess: async (_, id) => {
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
      await refreshSelectedOrder(id);
      toast({ title: "Commande clôturée" });
      setDetailsOpen(false);
    },
    onError: (e: any) =>
      toast({ title: "Erreur de clôture", description: String(e), variant: "destructive" }),
  });

  const payOrder = useMutation({
    mutationFn: (p: { orderId: number; amount: number; method: string; receivedAmount?: number }) =>
      api.post("/cash/payments", {
        department: "restaurant",
        method: p.method,
        amount: p.amount,
        receivedAmount: p.receivedAmount ?? null,
        orderId: p.orderId,
      }),
    onSuccess: async (data: any, vars) => {
      const change = data?.context?.change ?? 0;
      toast({
        title: "Paiement enregistré",
        description: change > 0 ? `Monnaie à rendre : ${fmt(change)} Ar` : "Paiement réussi",
      });
      setReceivedAmount("");
      await refreshSelectedOrder(vars.orderId);
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
    },
    onError: (e: any) =>
      toast({ title: "Erreur de paiement", description: e.response?.data?.error ?? String(e), variant: "destructive" }),
  });

  const applyDiscount = useMutation({
    mutationFn: (p: { orderId: number; discountAmount: number; discountType: string; discountReason: string }) =>
      api.patch(`/cash/orders/${p.orderId}/discount`, {
        discountAmount: p.discountAmount, discountType: p.discountType, discountReason: p.discountReason,
      }),
    onSuccess: async (_, vars) => {
      toast({ title: "Remise appliquée" });
      setDiscountInput("");
      setDiscountReason("");
      setShowDiscountForm(false);
      await refreshSelectedOrder(vars.orderId);
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
    },
    onError: (e: any) =>
      toast({ title: "Erreur de remise", description: e.response?.data?.error ?? String(e), variant: "destructive" }),
  });

  const removeDiscount = useMutation({
    mutationFn: (orderId: number) =>
      api.patch(`/cash/orders/${orderId}/discount`, { discountAmount: 0, discountType: "fixed", discountReason: "" }),
    onSuccess: async (_, orderId) => {
      toast({ title: "Remise supprimée" });
      await refreshSelectedOrder(orderId);
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
    },
    onError: (e: any) =>
      toast({ title: "Erreur de remise", description: e.response?.data?.error ?? String(e), variant: "destructive" }),
  });

  const updateLineStatus = useMutation({
    mutationFn: (p: { orderId: number; lineId: number; status: string }) =>
      api.patch(`/restaurant/orders/${p.orderId}/lines/${p.lineId}/status`, { status: p.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", "restaurant"] });
      qc.invalidateQueries({ queryKey: ["orders", "restaurant", "all"] });
    },
    onError: (e: any) =>
      toast({ title: "Erreur de mise à jour", description: String(e), variant: "destructive" }),
  });

  const handleUpdateLineStatus = useCallback(
    (orderId: number, lineId: number, status: string) => {
      updateLineStatus.mutate({ orderId, lineId, status });
    }, [updateLineStatus]
  );

  // UI Helpers
  const refreshSelectedOrder = async (orderId: number) => {
    setLoadingOrder(true);
    try {
      const order = await api.get<any>(`/restaurant/orders/${orderId}`);
      if (!order.orderNumber) order.orderNumber = formatOrderNumber(order.id, order.createdAt);
      if (!order.invoiceNumber) order.invoiceNumber = generateInvoiceNumber(order.id);
      setSelectedOrder(order);
    } catch {
      toast({ title: "Impossible de charger la commande", variant: "destructive" });
    } finally {
      setLoadingOrder(false);
    }
  };

  const openDetails = async (order: any) => {
    setDetailsOpen(true);
    setSelectedOrder(order);
    setReceivedAmount("");
    setDiscountInput("");
    setDiscountReason("");
    setShowDiscountForm(false);
    await refreshSelectedOrder(order.id);
  };

  const createOrderIfNeeded = async (tc: string): Promise<number> => {
    const ex = (allOrders as any[]).find((o: any) => o.table?.code === tc && o.status === "open");
    if (ex) return ex.id;
    const response = await createOrder.mutateAsync(tc);
    return (response as any).id;
  };

  const openCommentDialog = (item: { id: number; name: string; price: number }) => {
    if (!hasScope("orders:write") || !table || addingItem === item.id) return;
    setCommentDialog({ dishId: item.id, dishName: item.name, dishPrice: item.price });
  };

  const addItemWithComment = async (comment: string) => {
    if (!commentDialog || !table) return;
    setAddingItem(commentDialog.dishId);
    try {
      const oid = await createOrderIfNeeded(table);
      await addLine.mutateAsync({ orderId: oid, itemId: commentDialog.dishId, comment: comment.trim() || undefined });
      setCommentDialog(null);
    } finally {
      setAddingItem(null);
    }
  };

  const addItem = async (item: { id: number; name: string; price: number }) => {
    if (!hasScope("orders:write") || !table || addingItem === item.id) return;
    setAddingItem(item.id);
    try {
      const oid = await createOrderIfNeeded(table);
      await addLine.mutateAsync({ orderId: oid, itemId: item.id });
    } finally {
      setAddingItem(null);
    }
  };

  const fireStatusBadge = (s: string) => (
    <Badge className={FIRE_STYLE[s]?.split(" ").slice(0, 2).join(" ") ?? ""}>{FIRE_LABEL[s] ?? s}</Badge>
  );

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      open: "bg-yellow-50 text-yellow-700 border-yellow-200",
      closed: "bg-green-50 text-green-700 border-green-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    const labels: Record<string, string> = { open: "Active", closed: "Fermée", cancelled: "Annulée" };
    return <Badge variant="outline" className={styles[s] ?? styles.open}>{labels[s] ?? s}</Badge>;
  };

  const allDelivered = (lines: any[]) =>
    lines?.length > 0 && lines.every(l => l.fireStatus === "delivered");

  const getPrepTime = (lines: any[]) =>
    lines ? lines.reduce((m, l) => Math.max(m, l.itempreparationTime ?? 0), 0) : 0;

  // CORRECTION: handlePay modifié pour permettre les paiements partiels (comme CasinoPOS)
  const handlePay = () => {
    const amountToCollect = Number(receivedAmount);
    const currentBalance = selectedOrder ? orderBalance(selectedOrder) : 0;

    if (!amountToCollect || amountToCollect <= 0) {
      toast({ title: "Montant de paiement invalide", description: "Veuillez entrer un montant valide", variant: "destructive" });
      return;
    }

    // Pas de vérification si le montant est inférieur au solde
    // On collecte exactement ce que le client donne
    // La facture gérera l'affichage du reste à payer ou du crédit
    payOrder.mutate({
      orderId: selectedOrder.id,
      amount: currentBalance,
      method: payMethod,
      receivedAmount: amountToCollect,
    });
  };

  const handleApplyDiscount = () => {
    if (discountInput === "" || Number(discountInput) < 0) {
      toast({ title: "Veuillez entrer une remise valide", variant: "destructive" });
      return;
    }
    applyDiscount.mutate({
      orderId: selectedOrder.id,
      discountAmount: Number(discountInput),
      discountType,
      discountReason: discountReason.trim(),
    });
  };

  // RENDER
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* Title + tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold">Restaurant POS</h1>
              <p className="text-muted-foreground">Tables → Plats → Paiement</p>
            </div>

            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(["pos", "waiters"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {tab === "pos" && <Utensils className="inline h-4 w-4 mr-1.5 -mt-0.5" />}
                  {tab === "waiters" && <Users className="inline h-4 w-4 mr-1.5 -mt-0.5" />}
                  {tab === "pos" ? "Restaurant" : "Serveurs"}
                </button>
              ))}
            </div>
          </div>

          {/* POS Tab */}
          {activeTab === "pos" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Tables */}
              <Card>
                <CardHeader><CardTitle>Tables</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 rounded border bg-background text-sm"
                      placeholder="Code (ex: R1)"
                      value={newTableCode}
                      onChange={e => setNewTableCode(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && newTableCode.trim() && createTable.mutate(newTableCode.trim())}
                    />
                    <Button onClick={() => newTableCode.trim() && createTable.mutate(newTableCode.trim())} disabled={createTable.isPending}>
                      <PlusSquare className="w-4 h-4 mr-1" />
                      {createTable.isPending ? "…" : "Créer"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(tables as any[]).map((t: any) => {
                      const code = t.code ?? String(t.id);
                      const tOrders = getTableOrders(code);
                      return (
                        <div key={code} className="flex items-center gap-1">
                          <Button variant={table === code ? "default" : "outline"} onClick={() => setTable(code)} className="relative">
                            {code}
                            {tOrders.length > 0 && (
                              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                                {tOrders.length}
                              </Badge>
                            )}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingTable(t)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            disabled={removeTable.isPending || tOrders.length > 0}
                            title={tOrders.length > 0 ? "Commandes actives" : "Supprimer"}
                            onClick={() => {
                              if (tOrders.length > 0) { toast({ title: "Fermez d'abord les commandes", variant: "destructive" }); return; }
                              if (confirm(`Supprimer la table ${code} ?`)) removeTable.mutate(t.id);
                            }}
                          >
                            {removeTable.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : tOrders.length > 0 ? <Clock className="w-4 h-4 text-orange-500" /> : <Trash2 className="w-4 h-4 text-red-600" />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {editingTable && (
                    <div className="flex gap-2 mt-2">
                      <input
                        className="flex-1 px-3 py-2 rounded border bg-background text-sm"
                        value={editingTable.code}
                        onChange={e => setEditingTable({ ...editingTable, code: e.target.value })}
                      />
                      <Button onClick={() => editTableMut.mutate({ id: editingTable.id, code: editingTable.code })} disabled={editTableMut.isPending}>
                        {editTableMut.isPending ? "…" : "Enregistrer"}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingTable(null)}>Annuler</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Menu */}
              <Card>
                <CardHeader><CardTitle>Carte</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Input placeholder="Rechercher…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  {!selectedCategory ? (
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.filter(cat => (dishes as any[]).some((d: any) => d.category === cat.key)).map(cat => {
                        const count = (dishes as any[]).filter((d: any) => d.category === cat.key).length;
                        return (
                          <Button key={cat.key} variant="outline" className="h-auto p-4 flex flex-col items-center gap-1 w-full" onClick={() => setSelectedCategory(cat.key)}>
                            <Utensils className="h-5 w-5" />
                            <span className="font-medium text-sm text-center">{cat.label}</span>
                            <span className="text-xs text-muted-foreground">{count} plat{count > 1 ? "s" : ""}</span>
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-foreground" onClick={() => setSelectedCategory(null)}>
                        <ChevronLeft className="h-4 w-4" />Retour
                      </Button>
                      <p className="text-sm font-medium">{CATEGORIES.find(c => c.key === selectedCategory)?.label}</p>
                      {dishesLoading && <div className="text-center text-sm text-muted-foreground py-4">Chargement…</div>}
                      <div className="grid grid-cols-2 gap-2">
                        {filteredDishes.filter((d: any) => d.category === selectedCategory).length === 0 && !dishesLoading ? (
                          <div className="col-span-2 text-center text-sm text-muted-foreground py-4">
                            {searchTerm ? "Aucun plat trouvé" : "Aucun plat dans cette catégorie"}
                          </div>
                        ) : (
                          filteredDishes.filter((d: any) => d.category === selectedCategory).map((dish: any) => (
                            <div key={dish.id} className="relative group">
                              <Button
                                variant="outline"
                                className="h-auto p-3 flex flex-col w-full overflow-hidden min-w-0"
                                onClick={() => addItem({ id: dish.id, name: dish.name, price: dish.price })}
                                disabled={addingItem === dish.id || !hasScope("orders:write") || !table || !!dishesError}
                              >
                                <Utensils className="h-5 w-5 mb-1" />
                                <span className="font-medium text-sm text-center w-full truncate leading-tight line-clamp-2 break-words">{dish.name}</span>
                                <span className="text-xs text-muted-foreground">{fmt(dish.price)} Ar</span>
                                {addingItem === dish.id && <div className="text-xs text-blue-600 mt-1">Ajout…</div>}
                              </Button>
                              {hasScope("orders:write") && table && !dishesError && (
                                <Button
                                  size="icon" variant="secondary"
                                  className="absolute -top-2 -right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                  onClick={() => openCommentDialog({ id: dish.id, name: dish.name, price: dish.price })}
                                  disabled={addingItem === dish.id}
                                  title="Instruction spéciale"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="icon" variant="secondary"
                                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                onClick={() => setDetailDialog(dish)}
                                title="Voir détails"
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Orders */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardList className="h-5 w-5 text-primary" /> Commandes
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => { refetchOrders(); toast({ title: "Actualisation…" }); }}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {!table ? (
                    <div className="text-sm text-muted-foreground text-center py-6">Sélectionnez une table</div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">Table <span className="font-semibold text-foreground">{table}</span></p>
                      {tableOrders.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-6 text-center border rounded-lg">Aucune commande active</div>
                      ) : (
                        tableOrders.map((order: any) => {
                          const orderNum = order.orderNumber || formatOrderNumber(order.id, order.createdAt);
                          const invoiceNum = order.invoiceNumber || generateInvoiceNumber(order.id);
                          const sub = orderSubtotal(order);
                          const disc = orderDiscount(order);
                          const tot = orderTotal(order);

                          return (
                            <div key={order.id} className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Hash className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">{orderNum}</span>
                                  <span className="text-xs text-muted-foreground">(ID: {order.id})</span>
                                </div>
                                {statusBadge(order.status)}
                              </div>
                              {order.table?.assignedWaiter && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <User className="h-3 w-3" />
                                  Serveur: {order.table.assignedWaiter.name}
                                </div>
                              )}
                              <div className="flex items-center justify-between bg-muted/20 rounded px-3 py-1.5 text-xs">
                                <span className="text-muted-foreground">N° facture</span>
                                <span className="font-mono font-medium">{invoiceNum}</span>
                              </div>
                              <div className="divide-y">
                                {(order.lines ?? []).length === 0 ? (
                                  <div className="text-xs text-muted-foreground italic py-2">Aucun article</div>
                                ) : (
                                  (order.lines ?? [])
                                    .sort((a, b) => getIndex(a.item?.category) - getIndex(b.item?.category))
                                    .map((line: any, i: number) => (
                                      <div key={line.id ?? i} className="flex justify-between items-start py-2 text-sm gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap font-medium">
                                            {line.itemName} ×{line.qty}
                                            {fireStatusBadge(line.fireStatus)}
                                          </div>
                                          {line.comment && (
                                            <div className="mt-1 text-xs italic text-muted-foreground bg-muted/30 p-1.5 rounded flex items-start gap-1.5">
                                              <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                              <span>{line.comment}</span>
                                            </div>
                                          )}
                                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />{line.itempreparationTime ?? 0} min
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                          <div className="font-semibold whitespace-nowrap">{fmt(line.unitPrice * line.qty)} Ar</div>
                                          {order.status === "open" && (
                                            <div className="flex gap-1">
                                              {/* Bouton MOINS */}
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 w-6 p-0 text-red-600 border-red-200 hover:bg-red-50"
                                                title="Diminuer d'1 unité"
                                                disabled={decrementLine.isPending}
                                                onClick={() => decrementLine.mutate({
                                                  orderId: order.id,
                                                  lineId: line.id,
                                                  currentQty: line.qty,
                                                })}
                                              >
                                                <Minus className="h-3.5 w-3.5" />
                                              </Button>
                                              {/* Bouton PLUS */}
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 w-6 p-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                                                title="Ajouter 1 unité"
                                                disabled={incrementLine.isPending}
                                                onClick={() => incrementLine.mutate({
                                                  orderId: order.id,
                                                  lineId: line.id,
                                                  currentQty: line.qty,
                                                })}
                                              >
                                                <Plus className="h-3.5 w-3.5" />
                                              </Button>
                                              {line.fireStatus !== "delivered" && (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-6 px-1.5 text-green-700 border-green-200 hover:bg-green-50 text-xs font-medium"
                                                  title="Marquer comme livré"
                                                  disabled={updateLineStatus.isPending}
                                                  onClick={() => handleUpdateLineStatus(order.id, line.id, "delivered")}
                                                >
                                                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                                                  Livré
                                                </Button>
                                              )}
                                              {line.fireStatus === "delivered" && (
                                                <span className="h-6 px-1.5 inline-flex items-center text-xs text-green-600 font-medium">
                                                  <CheckCheck className="h-3.5 w-3.5 mr-1" />Livré
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                )}
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t">
                                <div>
                                  {disc > 0 && <div className="text-xs text-muted-foreground line-through">{fmt(sub)} Ar</div>}
                                  <div className="font-semibold text-sm">
                                    {fmt(tot)} Ar
                                    {disc > 0 && (
                                      <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">-{fmt(disc)} Ar</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">⏱ {getPrepTime(order.lines ?? [])} min</div>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  <Button size="sm" variant="ghost" title="Ticket 80mm" onClick={() => print80mm(table!, order)}>
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                  {order.status === "open" && (
                                    <Button size="sm" disabled={!allDelivered(order.lines ?? [])} onClick={() => closeOrder.mutate(order.id)}>
                                      {closeOrder.isPending ? "…" : "Fermer"}
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => openDetails(order)}>
                                    Détails / Payer
                                  </Button>
                                </div>
                              </div>
                              {!allDelivered(order.lines ?? []) && (order.lines ?? []).length > 0 && (
                                <div className="text-xs text-orange-600 bg-orange-50 rounded p-2">
                                  Tous les plats n'ont pas encore été livrés
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "waiters" && (
            <WaiterAssignment
              tables={tables as any[]}
              onAssignmentChange={() => {
                refetchOrders();
              }}
            />
          )}

        </main>
      </div>

      {/* Dialog Comment */}
      <Dialog open={!!commentDialog} onOpenChange={open => !open && setCommentDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Instruction spéciale</DialogTitle>
            <DialogDescription>{commentDialog?.dishName} — {commentDialog && fmt(commentDialog.dishPrice)} Ar</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <textarea
              id="comment-input"
              className="w-full min-h-[90px] px-3 py-2 rounded-md border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Ex: sans oignons, bien cuit, sauce à côté…"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Visible sur le ticket cuisine.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCommentDialog(null)}>Annuler</Button>
            <Button
              onClick={() => addItemWithComment((document.getElementById("comment-input") as HTMLTextAreaElement)?.value ?? "")}
              disabled={addingItem === commentDialog?.dishId}
            >
              {addingItem === commentDialog?.dishId ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Dish Details */}
      <Dialog open={!!detailDialog} onOpenChange={open => !open && setDetailDialog(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg">{detailDialog?.name}</DialogTitle>
            <div className="mt-1">
              <Badge variant="secondary">
                {CATEGORIES.find(c => c.key === detailDialog?.category)?.label ?? detailDialog?.category}
              </Badge>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {detailDialog?.description && <p className="text-sm text-muted-foreground">{detailDialog.description}</p>}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center justify-center rounded-lg border p-3 gap-1">
                <span className="text-lg font-semibold">{detailDialog && fmt(detailDialog.price)}</span>
                <span className="text-xs text-muted-foreground">Ar</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border p-3 gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{detailDialog?.preparationTime} min</span>
                <span className="text-xs text-muted-foreground">Préparation</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border p-3 gap-1">
                <span className="text-sm font-medium capitalize">
                  {detailDialog?.difficulty === "easy" ? "Facile" : detailDialog?.difficulty === "medium" ? "Moyen" : detailDialog?.difficulty === "hard" ? "Difficile" : detailDialog?.difficulty}
                </span>
                <span className="text-xs text-muted-foreground">Difficulté</span>
              </div>
            </div>
            {detailDialog?.ingredients && (
              <div>
                <p className="text-sm font-medium mb-2">Ingrédients</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(detailDialog.ingredients) ? detailDialog.ingredients : Object.values(detailDialog.ingredients)).map((ing: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs flex items-center gap-1">
                      <span>{ing.itemName ?? ing.name ?? String(ing)}</span>
                      {ing.quantity && <span className="text-muted-foreground">{ing.quantity}{ing.unit ? ` ${ing.unit}` : ""}</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${detailDialog?.isActive ? "bg-green-500" : "bg-red-400"}`} />
              <span className="text-muted-foreground">{detailDialog?.isActive ? "Disponible" : "Indisponible"}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDetailDialog(null)}>Fermer</Button>
            {hasScope("orders:write") && table && !dishesError && (
              <Button
                onClick={() => { addItem({ id: detailDialog.id, name: detailDialog.name, price: detailDialog.price }); setDetailDialog(null); }}
                disabled={addingItem === detailDialog?.id}
              >
                {addingItem === detailDialog?.id ? "Ajout…" : "Ajouter à la commande"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Details / Payment / Discount - AVEC PAIEMENTS PARTIELS comme CasinoPOS */}
      <Dialog open={detailsOpen} onOpenChange={open => { if (!open) { setDetailsOpen(false); setSelectedOrder(null); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Commande {selectedOrder?.orderNumber || `#${selectedOrder?.id}`}</DialogTitle>
            <DialogDescription>Table {selectedOrder?.table?.code ?? "—"} · {selectedOrder?.status === "open" ? "Active" : "Fermée"}</DialogDescription>
          </DialogHeader>

          {loadingOrder && <div className="py-8 text-center text-muted-foreground text-sm">Chargement…</div>}

          {selectedOrder && !loadingOrder && (() => {
            const sub = orderSubtotal(selectedOrder);
            const disc = orderDiscount(selectedOrder);
            const tot = orderTotal(selectedOrder);
            const paid = orderPaid(selectedOrder);
            const bal = orderBalance(selectedOrder);
            const orderNum = selectedOrder.orderNumber || formatOrderNumber(selectedOrder.id, selectedOrder.createdAt);
            const invoiceNum = selectedOrder.invoiceNumber || generateInvoiceNumber(selectedOrder.id);

            return (
              <div className="space-y-4">

                {/* Order numbers */}
                <div className="bg-muted/20 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">N° commande</span>
                    <p className="font-mono font-medium text-sm">{orderNum}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">N° facture</span>
                    <p className="font-mono font-medium text-sm">{invoiceNum}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="border rounded overflow-hidden">
                  <div className="grid grid-cols-5 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <div className="col-span-2">Article</div>
                    <div className="text-left">Statut</div>
                    <div className="text-right">Qté</div>
                    <div className="text-right">Sous-total</div>
                  </div>
                  <div className="divide-y max-h-[260px] overflow-y-auto">
                    {(selectedOrder.lines ?? []).length === 0 ? (
                      <div className="px-3 py-4 text-center text-muted-foreground text-sm">Aucun article</div>
                    ) : (
                      (selectedOrder.lines ?? []).map((l: any) => (
                        <div key={l.id} className="px-3 py-2 text-sm hover:bg-muted/20 transition-colors">
                          <div className="grid grid-cols-5 items-center gap-2">
                            <div className="col-span-2">
                              <div className="font-medium">{l.itemName}</div>
                              {l.comment && (
                                <div className="text-xs italic text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MessageSquare className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{l.comment}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-left">{fireStatusBadge(l.fireStatus)}</div>
                            <div className="text-right font-mono">{l.qty}</div>
                            <div className="text-right font-semibold font-mono">{fmt(l.unitPrice * l.qty)} Ar</div>
                          </div>
                          <div className="flex justify-end mt-1">
                            <Button
                              size="sm" variant="ghost"
                              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteLine(selectedOrder.id, l.id, l.itemName)}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Amount summary */}
                <div className="bg-muted/10 rounded-lg border p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span className="font-mono">{fmt(sub)} Ar</span>
                  </div>
                  {disc > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        Remise
                        {selectedOrder.discountReason && <span className="text-xs text-amber-600 italic">({selectedOrder.discountReason})</span>}
                        {selectedOrder.discountType === "percent" && sub > 0 && (
                          <span className="text-xs bg-amber-100 px-1.5 rounded-full">{Math.round((disc / sub) * 100)}%</span>
                        )}
                      </span>
                      <span className="font-mono font-semibold">-{fmt(disc)} Ar</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1.5">
                    <span>Total TTC</span>
                    <span className="font-mono">{fmt(tot)} Ar</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Déjà collecté</span>
                    <span className="font-mono">-{fmt(paid)} Ar</span>
                  </div>
                  <div className={`flex justify-between font-bold text-base border-t pt-1.5 ${bal > 0 ? "text-red-600" : "text-green-600"}`}>
                    <span>{bal > 0 ? "Montant dû" : "Payé intégralement ✓"}</span>
                    <span className="font-mono">{fmt(bal)} Ar</span>
                  </div>
                </div>

                {/* CARD FEE INFO on already made payments */}
                {currentCardFees.cardAmount > 0 && (
                  <CardFeesInfoBanner cardAmount={currentCardFees.cardAmount} />
                )}

                {/* DISCOUNT */}
                {selectedOrder.status === "open" && (
                  <div className="border border-amber-200 rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-50 hover:bg-amber-100 transition-colors text-sm font-medium text-amber-800"
                      onClick={() => setShowDiscountForm(v => !v)}
                    >
                      <span className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        {disc > 0 ? (
                          <>Remise appliquée :&nbsp;<span className="font-bold">-{fmt(disc)} Ar</span>{selectedOrder.discountReason && <span className="font-normal text-amber-600">({selectedOrder.discountReason})</span>}</>
                        ) : "Appliquer une remise"}
                      </span>
                      <div className="flex items-center gap-2">
                        {disc > 0 && (
                          <button
                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors"
                            onClick={e => { e.stopPropagation(); removeDiscount.mutate(selectedOrder.id); }}
                            disabled={removeDiscount.isPending}
                          >
                            <X className="h-3 w-3" />{removeDiscount.isPending ? "…" : "Supprimer"}
                          </button>
                        )}
                        <ChevronDown className={`h-4 w-4 transition-transform ${showDiscountForm ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {showDiscountForm && (
                      <div className="p-3 bg-amber-50/50 space-y-3 border-t border-amber-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Type de remise</label>
                            <div className="flex rounded-md overflow-hidden border">
                              <button
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${discountType === "fixed" ? "bg-amber-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                onClick={() => { setDiscountType("fixed"); setDiscountInput(""); }}
                              >
                                <Tag className="h-3 w-3" /> Montant
                              </button>
                              <button
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors border-l ${discountType === "percent" ? "bg-amber-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                onClick={() => { setDiscountType("percent"); setDiscountInput(""); }}
                              >
                                <Percent className="h-3 w-3" /> %
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              {discountType === "percent" ? "Pourcentage (0–100)" : "Montant (Ar)"}
                            </label>
                            <Input
                              type="number" min={0} max={discountType === "percent" ? 100 : sub}
                              step={discountType === "percent" ? 1 : 100}
                              className="h-8 text-sm"
                              placeholder={discountType === "percent" ? "Ex: 10" : "Ex: 5000"}
                              value={discountInput}
                              onChange={e => setDiscountInput(Number(e.target.value) || "")}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Motif (optionnel)</label>
                          <Input className="h-8 text-sm" placeholder="Ex: client fidèle, promotion du jour…" value={discountReason} onChange={e => setDiscountReason(e.target.value)} />
                        </div>
                        {discountInput !== "" && discountInput > 0 && (
                          <div className="bg-amber-100 border border-amber-300 rounded p-2.5 text-xs text-amber-800 space-y-0.5">
                            {discountType === "percent" && (
                              <div className="flex justify-between">
                                <span>Remise ({discountInput}%)</span>
                                <span className="font-semibold">-{fmt(discountPreviewAr)} Ar</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold">
                              <span>Nouveau total TTC</span>
                              <span>{fmt(Math.max(0, sub - discountPreviewAr))} Ar</span>
                            </div>
                            {discountPreviewAr > sub && (
                              <div className="text-red-700 font-medium">⚠ La remise dépasse le sous-total</div>
                            )}
                          </div>
                        )}
                        <Button
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white h-9"
                          onClick={handleApplyDiscount}
                          disabled={applyDiscount.isPending || discountInput === "" || Number(discountInput) <= 0 || discountPreviewAr > sub}
                        >
                          {applyDiscount.isPending
                            ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Application…</>
                            : <><Tag className="h-4 w-4 mr-2" />Appliquer{" "}{discountInput !== "" && discountPreviewAr > 0 ? `(-${fmt(discountPreviewAr)} Ar)` : ""}</>
                          }
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Recorded payments */}
                {(selectedOrder.payments ?? []).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Paiements enregistrés</div>
                    <div className="max-h-[150px] overflow-y-auto space-y-1">
                      {(selectedOrder.payments as any[]).map((p: any) => {
                        const change = p.receivedAmount ? Math.max(0, p.receivedAmount - p.amount) : 0;
                        const op = operatorLabel(p);
                        const pFees = p.method === "card" ? Math.round(p.amount * CARD_FEE_RATE) : 0;
                        return (
                          <div key={p.id} className={`text-xs rounded px-3 py-1.5 ${p.method === "card" ? "bg-blue-50 border border-blue-100" : "bg-green-50"}`}>
                            <div className="flex justify-between">
                              <span className="flex items-center gap-1">
                                {p.method === "card" && <CreditCard className="h-3 w-3 text-blue-600" />}
                                {METHOD_LBL[p.method] ?? p.method} · {new Date(p.receivedAt).toLocaleDateString("fr-FR")}
                              </span>
                              <span className={`font-semibold ${p.method === "card" ? "text-blue-700" : "text-green-700"}`}>{fmt(p.amount)} Ar</span>
                            </div>
                            {p.method === "card" && (
                              <div className="mt-1 pt-1 border-t border-blue-100 space-y-0.5">
                                <div className="flex justify-between text-blue-600">
                                  <span>Collecté par l'établissement</span>
                                  <span className="font-medium">{fmt(p.amount)} Ar</span>
                                </div>
                                <div className="flex justify-between text-red-500">
                                  <span>Frais bancaires (5%) — retenus par la banque</span>
                                  <span>+{fmt(pFees)} Ar</span>
                                </div>
                                <div className="flex justify-between text-blue-800 font-semibold">
                                  <span>Total débité de la carte</span>
                                  <span>{fmt(p.amount + pFees)} Ar</span>
                                </div>
                              </div>
                            )}
                            {p.receivedAmount && p.receivedAmount > p.amount && !p.method.includes("card") && (
                              <div className="flex justify-between text-muted-foreground mt-0.5">
                                <span>Reçu : {fmt(p.receivedAmount)} Ar</span>
                                <span className="text-blue-600 font-medium">Monnaie : {fmt(change)} Ar</span>
                              </div>
                            )}
                            {op && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full font-medium text-xs">👤 {op}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PAYMENT COLLECTION - AVEC PAIEMENTS PARTIELS (comme CasinoPOS) */}
                {selectedOrder.status === "open" && bal > 0 && (
                  <div className="space-y-3 border rounded p-3 bg-muted/10">
                    <div className="text-sm font-medium">Collecter le paiement</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Reste à payer : <span className="font-bold text-red-600">{fmt(bal)} Ar</span>
                    </div>

                    {/* Montant reçu - champ libre sans minimum */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Montant reçu du client (Ar)</label>
                      <Input
                        type="number"
                        step={100}
                        placeholder="Montant reçu"
                        value={receivedAmount}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setReceivedAmount(v > 0 ? v : "");
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter" && receivedAmount && Number(receivedAmount) > 0) {
                            handlePay();
                          }
                        }}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Mode de paiement</label>
                      <Select value={payMethod} onValueChange={v => setPayMethod(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Espèces</SelectItem>
                          <SelectItem value="card">Carte bancaire</SelectItem>
                          <SelectItem value="mobile">Mobile Money</SelectItem>
                          <SelectItem value="bank">Virement bancaire</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {receivedAmount && Number(receivedAmount) > 0 && (
                      <>
                        {/* Message de paiement partiel */}
                        {Number(receivedAmount) < bal && (
                          <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
                            ℹ️ Paiement partiel de {fmt(Number(receivedAmount))} Ar. 
                            Il restera {fmt(bal - Number(receivedAmount))} Ar à payer.
                          </div>
                        )}

                        {/* Message de monnaie pour les espèces */}
                        {payMethod === "cash" && Number(receivedAmount) > bal && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-blue-700">Monnaie à rendre</span>
                              <span className="font-bold text-blue-800 text-lg">{fmt(Number(receivedAmount) - bal)} Ar</span>
                            </div>
                          </div>
                        )}

                        {/* Message de crédit */}
                        {Number(receivedAmount) > bal && (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                            ℹ️ Le montant reçu ({fmt(Number(receivedAmount))} Ar) dépasse le reste dû ({fmt(bal)} Ar).
                            Un crédit de {fmt(Number(receivedAmount) - bal)} Ar sera enregistré.
                          </div>
                        )}

                        {/* Informations carte bancaire */}
                        {payMethod === "card" && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2 text-blue-800 font-medium text-xs">
                              <CreditCard className="h-3.5 w-3.5 shrink-0" />
                              Récapitulatif carte bancaire (information client)
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Montant consommé collecté</span>
                                <span className="font-semibold text-green-700">{fmt(Number(receivedAmount))} Ar</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-600">+ Frais bancaires (5%) — retenus par la banque</span>
                                <span className="text-red-600 font-semibold">+{fmt(nextCardFeePreview)} Ar</span>
                              </div>
                              <div className="flex justify-between border-t border-blue-200 pt-1">
                                <span className="text-blue-800 font-semibold">Total débité de la carte du client</span>
                                <span className="text-blue-800 font-bold">{fmt(Number(receivedAmount) + nextCardFeePreview)} Ar</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground italic">
                              L'établissement collecte {fmt(Number(receivedAmount))} Ar. Les {fmt(nextCardFeePreview)} Ar de frais sont retenus par la banque.
                            </p>
                          </div>
                        )}

                        {/* Informations Mobile Money */}
                        {payMethod === "mobile" && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-green-800 font-medium text-xs">
                              <span>📱</span>Paiement Mobile Money
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Montant à collecter : <strong>{fmt(Number(receivedAmount))} Ar</strong>
                            </p>
                          </div>
                        )}

                        {/* Informations Virement */}
                        {payMethod === "bank" && (
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-purple-800 font-medium text-xs">
                              <span>🏦</span>Virement bancaire
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Montant à virer : <strong>{fmt(Number(receivedAmount))} Ar</strong>
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    <Button
                      className="w-full"
                      onClick={handlePay}
                      disabled={
                        payOrder.isPending ||
                        !receivedAmount ||
                        Number(receivedAmount) <= 0
                      }
                    >
                      {payOrder.isPending ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Traitement...</>
                      ) : (
                        `Collecter ${receivedAmount ? fmt(Number(receivedAmount)) + " Ar" : ""}`
                      )}
                    </Button>
                  </div>
                )}

                {selectedOrder.status === "open" && bal === 0 && (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded p-3 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Commande entièrement payée
                  </div>
                )}

                {/* Bottom actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => print80mm(selectedOrder.table?.code ?? "—", selectedOrder)}>
                      <Printer className="h-4 w-4 mr-1" />80mm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => printA4(selectedOrder.table?.code ?? "—", selectedOrder)}>
                      <FileText className="h-4 w-4 mr-1" />A4
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    {selectedOrder.status === "open" && (
                      <Button size="sm" onClick={() => closeOrder.mutate(selectedOrder.id)} disabled={closeOrder.isPending}>
                        {closeOrder.isPending ? "…" : "Fermer"}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setDetailsOpen(false)}>Fermer</Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}