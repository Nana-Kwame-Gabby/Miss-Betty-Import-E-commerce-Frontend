// Business knowledge for the Miss Betty Import shopping assistant.
// Written from the storefront code and the Terms, Contact and Privacy pages.
// Update this file (and redeploy ai-chat) when a policy changes.
export const KNOWLEDGE = `
# About Miss Betty Import
Miss Betty Import is a Ghana-based online store (www.missbettyimport.com) that imports goods,
mainly from China, and sells them to customers in Ghana. Prices are in Ghana Cedis (GHS).
Customer support: WhatsApp +233 20 269 7541 (https://wa.me/233202697541). The Contact page
(/contact) lists all contact options.

# Accounts
- Sign up at /signup with full name, email, phone number and a password (at least 6
  characters). An optional referral code from a friend can be entered at sign-up.
- Log in at /login with email and password, or "Continue with Google" for existing customers.
- Forgot password: /forgot-password sends a reset link by email.
- Visitors can browse the Home page. Viewing the full shop, adding to cart, checkout and order
  history require an account.
- The cart is saved to the account, so it is the same on every phone or computer the customer
  logs in on.

# Two kinds of goods
## Available goods
- Already in stock in Ghana. Bought and delivered without waiting for shipping.
- No shipping fee is charged later for Available goods.
## Pre-order goods
- Ordered from abroad during an ordering window ("order period" / batch, e.g. "6th Batch Orders").
  The store collects orders for about a month, then buys and ships them together.
- Shipping time after the ordering month: sea shipping typically 2–3 months; air shipping 2–3 weeks.
- A separate shipping fee is charged per item when the goods are about to arrive (see Shipping fees).
- The admin can close pre-orders temporarily; while closed, pre-order items can't be bought
  (Available goods still can). A banner on the site explains when this happens.
Each product in the shop shows whether it is "Available" or "Pre-order".

# Shopping and checkout
- Browse the Shop (/shop) by category, search, and open a product to see photos, description,
  price, sizes and colours. Some products have different prices per size ("From GHS ...").
- Choose size and/or colour, then Add to Cart or Buy Now. Several variants of the same product
  can be added at once.
- Discounted products show the sale price with the old price crossed out and a SALE badge.
- Check the cart carefully before ordering: the store is not responsible for mistakes in the
  size, colour or style that the customer selected.
- Checkout (/checkout): confirm delivery details (full name, phone, region, town), optionally
  apply a coupon, then pay.

# Payment
- Payment is made online through Hubtel (mobile money and card) at checkout.
- All payments must be made in full before an order is placed. The order is created once the
  payment is confirmed.
- After paying, the customer sees an order confirmation page with the order ID (e.g. ORD-2026-...).

# Coupons and referrals
- Every customer has a personal referral code (see "My Referrals", /my-referrals).
- When a new customer signs up using your referral code, you receive a GHS 100 coupon.
- A coupon gives GHS 100 off an order whose subtotal is more than GHS 3,000. One coupon per order.
  It is only used up once the payment is confirmed.

# Orders and tracking
- "My Orders" (/my-orders) lists all of a customer's orders with their status.
- Order statuses: Ordered → Processing → Delivered. After delivery the customer taps
  "Confirm Received"; orders are marked Received automatically 72 hours after delivery.
  Orders can also be Cancelled.
- Delivery details (phone, region, town) can be updated from My Orders while the order still
  allows editing.
- Customers can leave a review after receiving an order.

# Shipping fees (pre-order goods only)
- Shipping fees are communicated about one month before the goods arrive and must be paid in
  full within two weeks of notification. Late payment may cause delays or penalties.
- Fees are billed individually, in Ghana Cedis, calculated with the dollar rate given by the
  shipping company (not banks, forex or Google rates).
- Pay them on the Shipping Fees page (/shipping-fees), online through Hubtel.
- If a customer does not pay the shipping fee within the two-week period, the goods will be
  auctioned off and the customer is entitled to a full refund (see Terms at /terms).

# Delivery
- Customers must give accurate delivery details; the store is not liable for losses caused by
  wrong details.
- Delivery is by Speedaf, VIP parcel office, or station cars, unless the customer asks otherwise.
- Bulk delivery and pickup are completed within two weeks after all goods have arrived. Goods
  are stored for one week after bulk delivery. Customers who want delivery after the bulk
  delivery period pay the rider's fee to the station.
- The store is not responsible for errors in size, colour or style chosen by the customer, so
  customers should recheck their cart before ordering.

# Cancellations and returns
- Orders can be cancelled within 24 hours of placing them by contacting customer service on
  WhatsApp.
- Returns are only accepted if goods are damaged beyond use, or significantly different from
  what was ordered. Claims must be reported within 24 hours of receiving the goods, with clear
  photo or video evidence.

# Product requests
- Can't find something? Logged-in customers can request a product on the Product Requests page
  (/product-requests). The team reviews requests and gets back to the customer.

# Notifications and promotions
- The bell icon shows notifications (new products, order updates, promotions).
- Promotions, countdown sales and discounts are shown on the Home and Shop pages. Only mention a
  discount if it appears in product data from the tools.

# Privacy and terms
- Terms and Conditions: /terms. Privacy Policy: /privacy-policy. By placing an order, customers
  agree to the Terms, which may change without notice.
`.trim();
