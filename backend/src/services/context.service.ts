import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import {
  getAllProducts,
  lookupOrder,
  recordOrderLookupFailure,
  searchProducts,
} from "../lib/inventory-orders.js";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ORDER_NUM_PATTERN = /\b(ORD-\d+)\b/i;
const ORDER_INTENT_PATTERN =
  /\b(where('s| is) my order|track(ing)?\s+(my\s+)?order|order\s+status|shipment\s+status|delivery\s+status|my\s+order)\b/i;
const INVENTORY_PATTERN =
  /\b(in\s*stock|out\s*of\s*stock|available|availability|how\s+many\s+left|stock\s+level|sizes?\s+(left|available)|price|how\s+much)\b/i;

function extractOrderCredentials(texts: string[]): {
  orderNumber: string | null;
  email: string | null;
} {
  let orderNumber: string | null = null;
  let email: string | null = null;

  for (const text of texts) {
    if (!orderNumber) {
      const match = text.match(ORDER_NUM_PATTERN);
      if (match) orderNumber = match[1]!.toUpperCase();
    }
    if (!email) {
      const match = text.match(EMAIL_PATTERN);
      if (match) email = match[0]!.toLowerCase();
    }
  }

  return { orderNumber, email };
}

function hasOrderIntent(text: string, categorySlug?: string): boolean {
  return ORDER_INTENT_PATTERN.test(text) || categorySlug === "order-status";
}

function hasInventoryIntent(text: string): boolean {
  return INVENTORY_PATTERN.test(text);
}

function formatOrderContext(order: NonNullable<
  Awaited<ReturnType<typeof lookupOrder>>["order"]
>): string {
  const lines = [
    `Order number: ${order.orderNumber}`,
    `Status: ${order.status}`,
    `Items: ${JSON.stringify(order.items)}`,
  ];
  if (order.trackingNumber) lines.push(`Tracking: ${order.trackingNumber}`);
  if (order.shippedAt)
    lines.push(`Shipped: ${order.shippedAt.toISOString().split("T")[0]}`);
  if (order.deliveredAt)
    lines.push(`Delivered: ${order.deliveredAt.toISOString().split("T")[0]}`);
  return lines.join("\n");
}

function formatProducts(
  products: Awaited<ReturnType<typeof searchProducts>>
): string {
  return products
    .map((p) => {
      const sizes = p.variants
        .map((v) => `${v.size}: ${v.inStock ? `${v.stock} in stock` : "out of stock"}`)
        .join(", ");
      return `- ${p.name} (SKU: ${p.sku}) — $${p.price.toFixed(2)} | Sizes: ${sizes}`;
    })
    .join("\n");
}

async function buildOrderContext(
  sessionId: string,
  userMessage: string,
  recentUserMessages: string[],
  categorySlug?: string
): Promise<string | null> {
  const combined = [userMessage, ...recentUserMessages];
  const orderIntent = combined.some((t) => hasOrderIntent(t, categorySlug));
  if (!orderIntent) return null;

  const { orderNumber, email } = extractOrderCredentials(combined);

  if (!orderNumber || !email) {
    return `[ORDER LOOKUP]
The customer is asking about an order. You need BOTH their order number (e.g. ORD-10001) AND the email address on the order before you can look it up. Ask for whichever is missing. Do not guess or fabricate order details.`;
  }

  const result = await lookupOrder(orderNumber, email);

  if (result.locked) {
    return `[ORDER LOOKUP]
Order ${orderNumber} is temporarily locked due to too many failed lookup attempts. Tell the customer to wait ${env.orderLockoutMinutes} minutes and try again, or offer email escalation.`;
  }

  if (result.found && result.order) {
    return `[ORDER LOOKUP — VERIFIED]
Use ONLY the following live order data in your reply. Do not invent additional details.
${formatOrderContext(result.order)}`;
  }

  await recordOrderLookupFailure(
    orderNumber,
    env.orderLockoutAttempts,
    env.orderLockoutMinutes
  );

  await prisma.session.update({
    where: { id: sessionId },
    data: { orderFailureCount: { increment: 1 } },
  });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { orderFailureCount: true },
  });

  const failures = session?.orderFailureCount ?? 1;
  const nearLimit = failures >= env.sessionOrderFailureLimit;

  return `[ORDER LOOKUP]
No order found matching order number ${orderNumber} and email ${email}. Tell the customer the details didn't match our records and ask them to double-check. Do not reveal whether the order number or email was wrong.${
    nearLimit
      ? " This customer has had multiple failed lookups — offer to escalate to a human agent via the support form."
      : ""
  }`;
}

async function buildInventoryContext(userMessage: string): Promise<string | null> {
  if (!hasInventoryIntent(userMessage)) return null;

  const products = await searchProducts(userMessage);
  const list = products.length > 0 ? products : await getAllProducts();

  if (list.length === 0) {
    return `[INVENTORY]
No product data available. Tell the customer you cannot check stock right now.`;
  }

  return `[INVENTORY — LIVE DATA]
Use ONLY this current stock and pricing data. Inventory changes frequently — do not cache or generalize these numbers.
${formatProducts(list.slice(0, 8))}`;
}

export async function buildLiveContext(
  sessionId: string,
  userMessage: string,
  recentUserMessages: string[],
  categorySlug?: string
): Promise<string> {
  const parts: string[] = [];

  const orderCtx = await buildOrderContext(
    sessionId,
    userMessage,
    recentUserMessages,
    categorySlug
  );
  if (orderCtx) parts.push(orderCtx);

  const inventoryCtx = await buildInventoryContext(userMessage);
  if (inventoryCtx) parts.push(inventoryCtx);

  return parts.join("\n\n");
}
