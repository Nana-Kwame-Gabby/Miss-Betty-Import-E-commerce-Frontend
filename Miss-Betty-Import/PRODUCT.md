# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Shoppers across Ghana, mostly individuals on phones, often arriving from a WhatsApp or social media link to a product. They browse the catalogue, compare a product's photos, video, sizes and colours, and either buy goods that are in stock in Ghana now or pre-order goods that are bought from China in batches. A smaller group buys directly from the owner (MoMo or cash) and is recorded by the admin as an offline buyer.

The second audience is the shop owner and admin team, who run the business from the admin dashboard: products, order periods, pre-orders, invoices, shipping fees, offline buyers, coupons, emails and SMS.

## Product Purpose

Miss Betty Import sells quality imported products in Ghana — kitchen appliances, sneakers, bags, fashion, home and baby items — at prices ordinary shoppers can reach, without them having to import from China themselves. Success is a shopper finding the item, trusting it, choosing the variant and paying in a few taps on a phone, then being kept informed until delivery.

## Positioning

The shop imports for its customers in organised **order periods** (batches): pre-order goods are collected during a period, bought from China together, then shipped; their shipping fee is set per product and size when the goods are about to arrive and paid separately on the Shipping Fees page. Alongside pre-orders, **Available** goods are already in Ghana with tracked stock. One shop, two ways to buy, with a Ghanaian owner reachable on WhatsApp.

## Operating Context

- Customers pay by Mobile Money or card through Hubtel; the site and prices are in Ghana cedis (GHS).
- Customers have accounts: My Orders, Shipping Fees, product requests ("find this for me"), referrals and coupons, notifications, and automated emails (order confirmation with PDF invoice, shipping-fee receipts, order-period announcements).
- Browsing is public (shop and product pages are indexed by search engines); adding to cart and buying require login.
- An AI shopping assistant ("Ask Betty") answers product questions in a chat widget.
- WhatsApp is the main human support channel: +233 20 269 7541.
- Product media (photos and short videos) is hosted on Cloudflare R2 and served resized.

## Capabilities and Constraints

- React 19 + Vite single-page app with Tailwind CSS v4, hosted on Vercel; Supabase (Postgres, auth, storage, edge functions) as the backend.
- Product statuses are **Pre-order** and **Available**; stock is tracked per size and colour for Available goods only.
- Prices can be set per size; a discount is a fixed amount off the profit and is shown as a sale price.
- Pre-orders close when an order period closes; the site must make this state clear.
- Many shoppers are on mid-range Android phones and mobile data: pages must stay light (resized images, lazy loading, code splitting are already in place).
- The admin dashboard is a separate, task-focused area of the same app.

## Brand Commitments

- Name: **Miss Betty Import**.
- Logo: the brown "MB" mark (`public/logo.png`, icons in `public/icon-*.png`).
- Brand colours to keep: deep navy (#1e2d3d) and amber (#F2AA25).
- Voice: friendly, plain and trustworthy; Ghanaian English; prices always in GHS.

## Evidence on Hand

- Real product photographs and videos for 650+ products (Supabase / R2), with descriptions, sizes, colours and prices.
- Real customer reviews exist on some products (the reviews table); most products have none yet. Never invent reviews, ratings, customer counts or delivery times.
- Contact: WhatsApp +233 20 269 7541; website www.missbettyimport.com.
- No press, certifications or partner logos on hand; do not add any.

## Product Principles

1. **Phone first, data light.** Every customer page is designed for a phone on mobile data before it is designed for a desktop.
2. **Trust before taps.** Show the real product clearly — photos, video, price, stock or pre-order status, delivery and shipping-fee rules — before asking for payment.
3. **Two ways to buy, never confused.** Pre-order and Available goods are always clearly labelled, with their different timing and shipping-fee rules.
4. **One clear next step.** Each screen has one main action (view, choose variant, add to cart, pay); everything else supports it.
5. **A real person behind the shop.** Help is one tap away on WhatsApp; copy sounds like the owner, not a corporation.

## Accessibility & Inclusion

- Text and controls must meet WCAG 2.1 AA contrast (4.5:1 for text, 3:1 for large text and UI); the current white-on-amber buttons fail this and must not be repeated.
- Touch targets at least 44px; works with system font scaling and reduced-motion settings.
