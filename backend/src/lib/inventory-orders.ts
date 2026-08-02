import { prisma } from "./prisma.js";
import type { OrderStatus } from "@prisma/client";

export interface OrderLookupResult {
  found: boolean;
  locked?: boolean;
  order?: {
    orderNumber: string;
    status: OrderStatus;
    items: unknown;
    trackingNumber: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
  };
}

export async function lookupOrder(
  orderNumber: string,
  customerEmail: string
): Promise<OrderLookupResult> {
  const normalizedOrder = orderNumber.trim().toUpperCase();
  const normalizedEmail = customerEmail.trim().toLowerCase();

  const lockout = await prisma.orderLookupLockout.findUnique({
    where: { orderNumber: normalizedOrder },
  });

  if (lockout?.lockedUntil && lockout.lockedUntil > new Date()) {
    return { found: false, locked: true };
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNumber: normalizedOrder,
      customerEmail: normalizedEmail,
    },
  });

  if (order) {
    if (lockout && lockout.failedAttempts > 0) {
      await prisma.orderLookupLockout.delete({
        where: { orderNumber: normalizedOrder },
      });
    }
    return {
      found: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        items: order.items,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
      },
    };
  }

  return { found: false };
}

export async function recordOrderLookupFailure(
  orderNumber: string,
  maxAttempts: number,
  lockoutMinutes: number
): Promise<{ locked: boolean; attempts: number }> {
  const normalizedOrder = orderNumber.trim().toUpperCase();
  const now = new Date();

  const updated = await prisma.orderLookupLockout.upsert({
    where: { orderNumber: normalizedOrder },
    update: { failedAttempts: { increment: 1 } },
    create: { orderNumber: normalizedOrder, failedAttempts: 1 },
  });

  let locked = false;
  if (updated.failedAttempts >= maxAttempts) {
    locked = true;
    await prisma.orderLookupLockout.update({
      where: { orderNumber: normalizedOrder },
      data: {
        lockedUntil: new Date(now.getTime() + lockoutMinutes * 60 * 1000),
      },
    });
  }

  return { locked, attempts: updated.failedAttempts };
}

export interface ProductAvailability {
  sku: string;
  name: string;
  price: number;
  description: string | null;
  variants: { size: string; stock: number; inStock: boolean }[];
}

export async function searchProducts(query: string): Promise<ProductAvailability[]> {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { variants: { orderBy: { size: "asc" } } },
    take: 10,
  });

  return products.map((p) => ({
    sku: p.sku,
    name: p.name,
    price: Number(p.price),
    description: p.description,
    variants: p.variants.map((v) => ({
      size: v.size,
      stock: v.stock,
      inStock: v.stock > 0,
    })),
  }));
}

export async function getProductBySku(sku: string): Promise<ProductAvailability | null> {
  const product = await prisma.product.findFirst({
    where: { sku: { equals: sku.trim(), mode: "insensitive" } },
    include: { variants: { orderBy: { size: "asc" } } },
  });

  if (!product) return null;

  return {
    sku: product.sku,
    name: product.name,
    price: Number(product.price),
    description: product.description,
    variants: product.variants.map((v) => ({
      size: v.size,
      stock: v.stock,
      inStock: v.stock > 0,
    })),
  };
}

export async function getAllProducts(): Promise<ProductAvailability[]> {
  const products = await prisma.product.findMany({
    include: { variants: { orderBy: { size: "asc" } } },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    sku: p.sku,
    name: p.name,
    price: Number(p.price),
    description: p.description,
    variants: p.variants.map((v) => ({
      size: v.size,
      stock: v.stock,
      inStock: v.stock > 0,
    })),
  }));
}
