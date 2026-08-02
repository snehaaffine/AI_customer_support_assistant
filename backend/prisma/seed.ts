import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_SYSTEM_PROMPT = `You are a helpful customer support assistant for an e-commerce retail store. You help customers with:

- Order status and shipping inquiries (ask for order number AND email on the order before looking up)
- Return and exchange policies (30-day returns on unworn items with tags attached)
- Shipping timelines (standard 5-7 business days, express 2-3 business days)
- Product availability, sizing, and pricing (use live inventory data when available)
- Store policies and general FAQs

Guidelines:
- Be friendly, concise, and professional
- Never share customer-specific order details in generic policy answers
- For order-specific questions, always verify order number + email before providing status
- If you cannot resolve an issue (disputes, refunds outside policy, damaged/lost items needing human review), offer to escalate to a human agent via email
- When escalating, tell the customer a short form will appear to collect their email and details. Support follow-up is by email only — never mention phone calls, callbacks, live chat handoffs, or call-back options
- Do not make up product information — use inventory data or say you don't know
- Keep policy answers generic so they can be safely cached`;

async function main() {
  console.log("Seeding database...");

  // Admin account
  const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: { passwordHash },
    create: { username: adminUsername, passwordHash },
  });
  console.log(`  Admin user: ${adminUsername}`);

  // System config
  const PROMPT_VERSION = 2;
  await prisma.systemConfig.upsert({
    where: { id: 1 },
    update: {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      promptVersion: PROMPT_VERSION,
    },
    create: {
      id: 1,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      promptVersion: PROMPT_VERSION,
    },
  });
  console.log("  System config");

  // Chat categories
  const categories = [
    {
      slug: "order-status",
      label: "Order status",
      description: "Track your order or ask about shipping",
      sortOrder: 1,
    },
    {
      slug: "damaged-lost",
      label: "Report a damaged/lost item",
      description: "Report missing or damaged products",
      sortOrder: 2,
    },
    {
      slug: "other",
      label: "Other",
      description: "Returns, sizing, products, and general questions",
      sortOrder: 3,
    },
  ];

  for (const cat of categories) {
    await prisma.chatCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log(`  ${categories.length} chat categories`);

  // Escalation rules
  const rules = [
    {
      name: "Explicit human request",
      type: "EXPLICIT_REQUEST" as const,
      config: {
        phrases: [
          "speak to a human",
          "talk to a human",
          "talk to a person",
          "real agent",
          "human agent",
          "customer service rep",
        ],
      },
      priority: 10,
    },
    {
      name: "Refund/dispute keywords",
      type: "KEYWORD" as const,
      config: {
        keywords: [
          "chargeback",
          "dispute",
          "lawyer",
          "sue",
          "fraud",
          "unauthorized charge",
        ],
      },
      priority: 9,
    },
    {
      name: "Negative sentiment keywords",
      type: "SENTIMENT" as const,
      config: {
        keywords: [
          "terrible",
          "awful",
          "worst",
          "never shopping",
          "scam",
          "horrible",
        ],
      },
      priority: 7,
    },
    {
      name: "Damaged/lost category auto-escalate",
      type: "CATEGORY" as const,
      config: { categorySlug: "damaged-lost" },
      priority: 8,
    },
    {
      name: "Repeated failed attempts",
      type: "FAILED_ATTEMPTS" as const,
      config: { maxAttempts: 3 },
      priority: 6,
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.escalationRule.findFirst({
      where: { name: rule.name },
    });
    if (existing) {
      await prisma.escalationRule.update({
        where: { id: existing.id },
        data: rule,
      });
    } else {
      await prisma.escalationRule.create({ data: rule });
    }
  }
  console.log(`  ${rules.length} escalation rules`);

  // Mock inventory
  const products = [
    {
      sku: "TEE-BLK-M",
      name: "Classic Cotton Tee — Black",
      description: "Soft 100% cotton crew neck tee in black.",
      price: 29.99,
      variants: [
        { size: "S", stock: 12 },
        { size: "M", stock: 8 },
        { size: "L", stock: 0 },
        { size: "XL", stock: 5 },
      ],
    },
    {
      sku: "JEAN-SLIM-32",
      name: "Slim Fit Jeans — Indigo",
      description: "Stretch denim slim fit jeans in classic indigo wash.",
      price: 79.99,
      variants: [
        { size: "30", stock: 4 },
        { size: "32", stock: 7 },
        { size: "34", stock: 3 },
        { size: "36", stock: 0 },
      ],
    },
    {
      sku: "HOOD-GRY-L",
      name: "Fleece Hoodie — Heather Gray",
      description: "Cozy pullover hoodie with kangaroo pocket.",
      price: 59.99,
      variants: [
        { size: "S", stock: 15 },
        { size: "M", stock: 10 },
        { size: "L", stock: 6 },
        { size: "XL", stock: 2 },
      ],
    },
    {
      sku: "SNKR-WHT-9",
      name: "Everyday Sneaker — White",
      description: "Lightweight casual sneaker with cushioned sole.",
      price: 89.99,
      variants: [
        { size: "8", stock: 3 },
        { size: "9", stock: 0 },
        { size: "10", stock: 5 },
        { size: "11", stock: 8 },
      ],
    },
  ];

  for (const p of products) {
    const { variants, ...productData } = p;
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: productData.name,
        description: productData.description,
        price: productData.price,
      },
      create: productData,
    });

    for (const v of variants) {
      await prisma.productVariant.upsert({
        where: {
          productId_size: { productId: product.id, size: v.size },
        },
        update: { stock: v.stock },
        create: { productId: product.id, size: v.size, stock: v.stock },
      });
    }
  }
  console.log(`  ${products.length} products with variants`);

  // Mock orders
  const orders = [
    {
      orderNumber: "ORD-10001",
      customerEmail: "alice@example.com",
      status: "SHIPPED" as const,
      items: [
        { sku: "TEE-BLK-M", name: "Classic Cotton Tee — Black", size: "M", quantity: 2 },
      ],
      trackingNumber: "1Z999AA10123456784",
      shippedAt: new Date("2026-07-28T10:00:00Z"),
    },
    {
      orderNumber: "ORD-10002",
      customerEmail: "bob@example.com",
      status: "PROCESSING" as const,
      items: [
        { sku: "JEAN-SLIM-32", name: "Slim Fit Jeans — Indigo", size: "32", quantity: 1 },
        { sku: "HOOD-GRY-L", name: "Fleece Hoodie — Heather Gray", size: "L", quantity: 1 },
      ],
    },
    {
      orderNumber: "ORD-10003",
      customerEmail: "carol@example.com",
      status: "DELIVERED" as const,
      items: [
        { sku: "SNKR-WHT-9", name: "Everyday Sneaker — White", size: "10", quantity: 1 },
      ],
      trackingNumber: "1Z999AA10987654321",
      shippedAt: new Date("2026-07-20T08:00:00Z"),
      deliveredAt: new Date("2026-07-24T14:30:00Z"),
    },
    {
      orderNumber: "ORD-10004",
      customerEmail: "alice@example.com",
      status: "PENDING" as const,
      items: [
        { sku: "HOOD-GRY-L", name: "Fleece Hoodie — Heather Gray", size: "M", quantity: 1 },
      ],
    },
  ];

  for (const order of orders) {
    await prisma.order.upsert({
      where: { orderNumber: order.orderNumber },
      update: order,
      create: order,
    });
  }
  console.log(`  ${orders.length} mock orders`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
