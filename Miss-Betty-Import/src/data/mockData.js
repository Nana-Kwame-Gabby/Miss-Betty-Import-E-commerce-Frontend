export const categories = [
  { id: 1,  name: "Mother care items",               icon: "👶" },
  { id: 2,  name: "Beddings",                        icon: "🛏️" },
  { id: 4,  name: "Furniture",                       icon: "🪑" },
  { id: 5,  name: "Industrial Equipment/Heavy Duty", icon: "🏗️" },
  { id: 6,  name: "Kitchenware",                     icon: "🍳" },
  { id: 7,  name: "Others",                          icon: "📦" },
  { id: 8,  name: "Home Appliances",                 icon: "🏠" },
  { id: 9,  name: "Home Designs/Decor",              icon: "🖼️" },
  { id: 10, name: "Men's Fashion",                   icon: "👔" },
  { id: 11, name: "Ladies Fashion",                  icon: "👜" },
  { id: 12, name: "Sneakers",                        icon: "👟" },
];

export const products = [
  // Mother care items
  {
    id: 1, category_id: 1, category: "Mother care items",
    product_name: "Baby Carrier Wrap",
    product_image_url: "https://picsum.photos/seed/mbp-baby1/400/500",
    unit_price: 180,
    description: "Ergonomic baby carrier wrap that keeps your baby close and comfortable. Supports newborns to toddlers, distributes weight evenly for parent comfort.",
    sizes: ["One Size"], colours: ["Grey", "Navy", "Pink"],
    product_status: "Available",
  },
  {
    id: 2, category_id: 1, category: "Mother care items",
    product_name: "Infant Bath Tub",
    product_image_url: "https://picsum.photos/seed/mbp-baby2/400/500",
    unit_price: 95,
    description: "Safe, non-slip infant bath tub with temperature indicator. Contoured design supports baby in the perfect bathing position.",
    sizes: ["One Size"], colours: ["Blue", "Yellow", "Green"],
    product_status: "Pre-order",
  },
  // Beddings
  {
    id: 3, category_id: 2, category: "Beddings",
    product_name: "6-Piece Bedsheet Set",
    product_image_url: "https://picsum.photos/seed/mbp-bed1/400/500",
    unit_price: 220,
    description: "Premium 100% cotton 6-piece bedsheet set. Soft, breathable, and fade-resistant. Includes flat sheet, fitted sheet, and 4 pillowcases.",
    sizes: ["Single", "Double", "King"], colours: ["White", "Blue", "Pink"],
    product_status: "Available",
  },
  {
    id: 4, category_id: 2, category: "Beddings",
    product_name: "Duvet & Pillow Set",
    product_image_url: "https://picsum.photos/seed/mbp-bed2/400/500",
    unit_price: 310,
    description: "Luxurious microfibre duvet paired with 2 matching pillows. Hypoallergenic filling, machine washable, suitable for all seasons.",
    sizes: ["Double", "King"], colours: ["White", "Grey"],
    product_status: "Available",
  },
  // Dresses, bags & shoes
  {
    id: 5, category_id: 3, category: "Dresses, bags & shoes",
    product_name: "Floral Midi Dress",
    product_image_url: "https://picsum.photos/seed/mbp-dress1/400/500",
    unit_price: 150,
    description: "Elegant floral midi dress with a flattering A-line cut. Lightweight fabric, perfect for all occasions from casual outings to evening events.",
    sizes: ["S", "M", "L", "XL"], colours: ["Red", "Blue", "White"],
    product_status: "Available",
  },
  {
    id: 6, category_id: 3, category: "Dresses, bags & shoes",
    product_name: "Quilted Shoulder Bag",
    product_image_url: "https://picsum.photos/seed/mbp-bag1/400/500",
    unit_price: 280,
    description: "Chic quilted shoulder bag with gold-tone hardware and multiple compartments. Spacious interior for everyday essentials.",
    sizes: ["One Size"], colours: ["Black", "Brown", "Beige"],
    product_status: "Pre-order",
  },
  // Furniture
  {
    id: 7, category_id: 4, category: "Furniture",
    product_name: "Foldable Study Desk",
    product_image_url: "https://picsum.photos/seed/mbp-furn1/400/500",
    unit_price: 450,
    description: "Space-saving foldable study desk with built-in storage shelf. Strong steel frame, easy to assemble, ideal for home offices and students.",
    sizes: ["One Size"], colours: ["White", "Brown"],
    product_status: "Pre-order",
  },
  {
    id: 8, category_id: 4, category: "Furniture",
    product_name: "Kids Storage Bookshelf",
    product_image_url: "https://picsum.photos/seed/mbp-furn2/400/500",
    unit_price: 380,
    description: "Colourful 5-tier kids storage bookshelf with open compartments. Sturdy construction, safe rounded edges, easy to assemble.",
    sizes: ["One Size"], colours: ["White", "Multicolor"],
    product_status: "Available",
  },
  // Electrical appliances
  {
    id: 9, category_id: 5, category: "Electrical appliances",
    product_name: "3-in-1 Blender",
    product_image_url: "https://picsum.photos/seed/mbp-elec1/400/500",
    unit_price: 195,
    description: "Powerful 3-in-1 blender — blend, chop, and grind. 600W motor, stainless steel blades, easy-clean design. Perfect for smoothies and cooking prep.",
    sizes: ["One Size"], colours: ["Black", "White", "Red"],
    product_status: "Available",
  },
  {
    id: 10, category_id: 5, category: "Electrical appliances",
    product_name: "Electric Steam Iron",
    product_image_url: "https://picsum.photos/seed/mbp-elec2/400/500",
    unit_price: 120,
    description: "High-pressure steam iron with non-stick soleplate and variable temperature settings. Removes stubborn wrinkles effortlessly.",
    sizes: ["One Size"], colours: ["White", "Blue"],
    product_status: "Pre-order",
  },
  // Kitchenware
  {
    id: 11, category_id: 6, category: "Kitchenware",
    product_name: "Non-stick Cookware Set",
    product_image_url: "https://picsum.photos/seed/mbp-kit1/400/500",
    unit_price: 280,
    description: "Premium 5-piece non-stick cookware set. Includes frying pan, saucepan, stockpot, and lids. PFOA-free coating, compatible with all hob types.",
    sizes: ["4-Piece", "6-Piece"], colours: ["Black", "Red"],
    product_status: "Available",
  },
  {
    id: 12, category_id: 6, category: "Kitchenware",
    product_name: "12-Piece Dinner Set",
    product_image_url: "https://picsum.photos/seed/mbp-kit2/400/500",
    unit_price: 165,
    description: "Elegant 12-piece ceramic dinner set. Includes 4 dinner plates, 4 side plates, and 4 bowls. Microwave and dishwasher safe.",
    sizes: ["One Size"], colours: ["White", "Cream"],
    product_status: "Available",
  },
  // Others
  {
    id: 13, category_id: 7, category: "Others",
    product_name: "LED Fairy Lights",
    product_image_url: "https://picsum.photos/seed/mbp-other1/400/500",
    unit_price: 55,
    description: "Warm, decorative LED fairy lights for bedrooms, parties, and events. Battery-powered with timer function, flexible copper wire.",
    sizes: ["3m", "5m", "10m"], colours: ["Warm White", "Multicolor"],
    product_status: "Available",
  },
  {
    id: 14, category_id: 7, category: "Others",
    product_name: "Portable Travel Organiser",
    product_image_url: "https://picsum.photos/seed/mbp-other2/400/500",
    unit_price: 85,
    description: "Compact travel organiser with multiple compartments for clothes, toiletries, and accessories. Waterproof lining, lightweight and durable.",
    sizes: ["One Size"], colours: ["Black", "Navy", "Grey"],
    product_status: "Pre-order",
  },
];

export const colourMap = {
  Red: "#ef4444", Blue: "#3b82f6", White: "#f8fafc", Black: "#111827",
  Beige: "#e8d5b7", Navy: "#1e3a5f", Orange: "#f97316", Green: "#22c55e",
  Purple: "#a855f7", Gold: "#F2AA25", Silver: "#9ca3af", Brown: "#92400e",
  Nude: "#d4a088", Grey: "#9ca3af", Tan: "#d2a679", Pink: "#ec4899",
  Tortoise: "#8B4513", Multicolor: "#F2AA25", Yellow: "#fbbf24",
  Cream: "#fef9c3", "Warm White": "#fef3c7",
};

export const mockReviews = [
  {
    id: 1,
    name: "Abena Mensah",
    initials: "AM",
    avatarColor: "#F2AA25",
    rating: 5,
    text: "Fast delivery and great quality! My baby carrier is exactly what I needed. My little one loves it and I can carry her comfortably all day.",
  },
  {
    id: 2,
    name: "Kofi Asante",
    initials: "KA",
    avatarColor: "#3b82f6",
    rating: 5,
    text: "The bedsheet set is beautiful — the fabric is so soft and the colours are vibrant. Washes perfectly without fading. Highly recommend!",
  },
  {
    id: 3,
    name: "Ama Darko",
    initials: "AD",
    avatarColor: "#22c55e",
    rating: 4,
    text: "Good quality kitchenware at a very affordable price. The non-stick cookware set is excellent. Will definitely be ordering again from Miss Betty Import.",
  },
];

export const mockOrders = [
  {
    order_id: "ORD-2024-001",
    date: "2024-11-15",
    items: [{ name: "Baby Carrier Wrap", qty: 1, size: "One Size", colour: "Grey" }, { name: "6-Piece Bedsheet Set", qty: 1, size: "King", colour: "White" }],
    total: 400,
    status: "Delivered",
    delivery: { region: "Ashanti", town: "Kumasi" },
    canEditDelivery: false,
  },
  {
    order_id: "ORD-2024-002",
    date: "2024-12-02",
    items: [{ name: "Floral Midi Dress", qty: 1, size: "M", colour: "Red" }],
    total: 150,
    status: "Processing",
    delivery: { region: "Greater Accra", town: "Accra" },
    canEditDelivery: true,
  },
  {
    order_id: "ORD-2025-001",
    date: "2025-01-10",
    items: [{ name: "Non-stick Cookware Set", qty: 1, size: "6-Piece", colour: "Black" }],
    total: 280,
    status: "Pending",
    delivery: { region: "Eastern", town: "Koforidua" },
    canEditDelivery: false,
  },
];

export const mockAdminStats = {
  totalOrders: 128,
  totalRevenue: 38450,
  totalProducts: 14,
  totalCustomers: 84,
};

export const mockAdminOrders = [
  { order_id: "ORD-2025-041", customer: "Abena Mensah", product: "Baby Carrier Wrap", qty: 1, total: 180, status: "Pending", date: "2025-05-10" },
  { order_id: "ORD-2025-040", customer: "Kwame Asante", product: "6-Piece Bedsheet Set", qty: 1, total: 220, status: "Processing", date: "2025-05-09" },
  { order_id: "ORD-2025-039", customer: "Ama Boateng", product: "Quilted Shoulder Bag", qty: 1, total: 280, status: "Delivered", date: "2025-05-08" },
  { order_id: "ORD-2025-038", customer: "Kofi Darko", product: "Non-stick Cookware Set", qty: 1, total: 280, status: "Delivered", date: "2025-05-07" },
  { order_id: "ORD-2025-037", customer: "Efua Sarpong", product: "Floral Midi Dress", qty: 1, total: 150, status: "Cancelled", date: "2025-05-06" },
];
