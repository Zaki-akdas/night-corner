// Seed data for all 53 Night Corner products.
export type SeedProduct = {
  name: string;
  categorySlug: string;
  description: string;
  shortDesc: string;
  price: number;
  mrp: number;
  stock: number;
  unit: string;
  isVeg: boolean;
  keywords: string;
  freshnessNote?: string;
  bestSeller?: boolean;
  featured?: boolean;
};

export const CATEGORIES: { name: string; slug: string; description: string; emoji: string; gradient: string }[] = [
  {
    name: "Bakery & Desserts",
    slug: "bakery-desserts",
    description: "Freshly baked puffs, pastries, brownies and cakes — baked for tonight.",
    emoji: "🧁",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    name: "Chips & Namkeen",
    slug: "chips-namkeen",
    description: "Crunchy chips, bhujia, mixtures and late-night munchies.",
    emoji: "🥨",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    name: "Chocolates & Sweets",
    slug: "chocolates-sweets",
    description: "Silk, KitKat, Snickers and your favourite chocolate bars.",
    emoji: "🍫",
    gradient: "from-amber-700 to-yellow-700",
  },
  {
    name: "Biscuits & Cookies",
    slug: "biscuits-cookies",
    description: "Parle-G, Oreo, Good Day, bourbon and cream biscuits.",
    emoji: "🍪",
    gradient: "from-yellow-600 to-amber-800",
  },
  {
    name: "Instant Food / Midnight Hunger",
    slug: "instant-food",
    description: "Maggi, noodles, pasta and ready-to-eat meals in minutes.",
    emoji: "🍜",
    gradient: "from-red-500 to-rose-700",
  },
  {
    name: "Drinks & Energy Drinks",
    slug: "drinks-energy",
    description: "Cold drinks, water, juices, energy and electrolyte drinks.",
    emoji: "🥤",
    gradient: "from-sky-500 to-blue-700",
  },
];

export const PRODUCTS: SeedProduct[] = [
  // Bakery (1-10) — fresh, daily stock
  { name: "Veg Puff", categorySlug: "bakery-desserts", description: "Flaky golden-brown pastry stuffed with spiced mixed vegetables. Freshly baked tonight.", shortDesc: "Flaky spiced veg pastry", price: 25, mrp: 30, stock: 5, unit: "1 pc", isVeg: true, keywords: "puff, pastry, veg, snack, bakery", freshnessNote: "Baked fresh tonight · best within 6 hours", bestSeller: true, featured: true },
  { name: "Paneer Puff", categorySlug: "bakery-desserts", description: "Crisp puff filled with rich, spiced paneer masala. A premium midnight snack.", shortDesc: "Spiced paneer stuffed pastry", price: 35, mrp: 40, stock: 5, unit: "1 pc", isVeg: true, keywords: "paneer, puff, pastry, bakery", freshnessNote: "Baked fresh tonight · best within 6 hours" },
  { name: "Veg Sandwich", categorySlug: "bakery-desserts", description: "Toasted bread with fresh vegetables, chutney and cheese. Grilled to order.", shortDesc: "Grilled veg cheese sandwich", price: 60, mrp: 70, stock: 5, unit: "1 pc", isVeg: true, keywords: "sandwich, grilled, veg, cheese", freshnessNote: "Made fresh after order", bestSeller: true },
  { name: "Chocolate Pastry", categorySlug: "bakery-desserts", description: "Soft chocolate sponge layered with silky chocolate cream and ganache.", shortDesc: "Silky chocolate cream pastry", price: 55, mrp: 65, stock: 5, unit: "1 pc", isVeg: true, keywords: "pastry, chocolate, cake, dessert", featured: true },
  { name: "Black Forest Pastry", categorySlug: "bakery-desserts", description: "Classic chocolate sponge with cherries, whipped cream and chocolate shavings.", shortDesc: "Cherry & cream black forest", price: 60, mrp: 70, stock: 5, unit: "1 pc", isVeg: true, keywords: "black forest, pastry, cake, cherry" },
  { name: "Brownie", categorySlug: "bakery-desserts", description: "Fudgy walnut chocolate brownie with a crackly top. Warm it for 20 seconds.", shortDesc: "Fudgy walnut chocolate brownie", price: 70, mrp: 80, stock: 5, unit: "1 pc", isVeg: true, keywords: "brownie, chocolate, fudge, walnut", bestSeller: true },
  { name: "Muffin", categorySlug: "bakery-desserts", description: "Fluffy vanilla muffin loaded with chocolate chips.", shortDesc: "Choco-chip vanilla muffin", price: 40, mrp: 50, stock: 5, unit: "1 pc", isVeg: true, keywords: "muffin, cupcake, choco chip" },
  { name: "Donut", categorySlug: "bakery-desserts", description: "Soft ring donut dipped in glossy chocolate glaze.", shortDesc: "Chocolate glazed donut", price: 65, mrp: 75, stock: 5, unit: "1 pc", isVeg: true, keywords: "donut, doughnut, chocolate, glazed" },
  { name: "Cookies", categorySlug: "bakery-desserts", description: "Buttery chocolate-chip cookies, pack of 4. Crisp edges, chewy centre.", shortDesc: "Choco-chip cookies (4 pcs)", price: 50, mrp: 60, stock: 5, unit: "1 pack", isVeg: true, keywords: "cookies, choco chip, butter" },
  { name: "Cup Cake", categorySlug: "bakery-desserts", description: "Soft frosted cupcake with a creamy vanilla topping.", shortDesc: "Frosted vanilla cup cake", price: 35, mrp: 45, stock: 5, unit: "1 pc", isVeg: true, keywords: "cupcake, cake, frosting" },

  // Chips & Namkeen (11-20)
  { name: "Lays — Different Flavours", categorySlug: "chips-namkeen", description: "Crispy potato chips in classic salted, masala, cream & onion and more (flavour may vary by stock).", shortDesc: "Crispy potato chips, assorted", price: 20, mrp: 20, stock: 5, unit: "52 g", isVeg: true, keywords: "lays, chips, potato, salted, masala", bestSeller: true },
  { name: "Kurkure", categorySlug: "chips-namkeen", description: "Crunchy, spicy namkeen sticks with the signature masala twist.", shortDesc: "Spicy crunchy namkeen sticks", price: 20, mrp: 20, stock: 5, unit: "90 g", isVeg: true, keywords: "kurkure, namkeen, spicy, crunchy" },
  { name: "Bingo", categorySlug: "chips-namkeen", description: "Crispy mad-angles and potato chips in tangy flavours.", shortDesc: "Tangy crispy snacks", price: 20, mrp: 20, stock: 4, unit: "90 g", isVeg: true, keywords: "bingo, chips, mad angles" },
  { name: "Uncle Chipps", categorySlug: "chips-namkeen", description: "The classic Indian potato chips, lightly salted and crisp.", shortDesc: "Classic salted potato chips", price: 20, mrp: 20, stock: 4, unit: "52 g", isVeg: true, keywords: "uncle chipps, chips, potato" },
  { name: "Aloo Bhujia", categorySlug: "chips-namkeen", description: "Spicy gram-flour and potato sev, perfect for late-night snacking.", shortDesc: "Spicy aloo bhujia sev", price: 45, mrp: 50, stock: 4, unit: "200 g", isVeg: true, keywords: "aloo bhujia, sev, namkeen" },
  { name: "Bikaneri Bhujia", categorySlug: "chips-namkeen", description: "Authentic Bikaneri-style spicy bhujia, rich and crunchy.", shortDesc: "Authentic Bikaneri bhujia", price: 55, mrp: 60, stock: 4, unit: "200 g", isVeg: true, keywords: "bikaneri, bhujia, sev, namkeen" },
  { name: "Mixture", categorySlug: "chips-namkeen", description: "South-Indian style mixture with sev, peanuts, curry leaves and boondi.", shortDesc: "Spicy south-style mixture", price: 50, mrp: 60, stock: 4, unit: "200 g", isVeg: true, keywords: "mixture, namkeen, peanuts, boondi" },
  { name: "Moong Dal", categorySlug: "chips-namkeen", description: "Roasted and salted moong dal — crunchy, protein-rich munch.", shortDesc: "Crunchy salted moong dal", price: 40, mrp: 50, stock: 3, unit: "200 g", isVeg: true, keywords: "moong dal, namkeen, protein" },
  { name: "Peanuts", categorySlug: "chips-namkeen", description: "Masala roasted peanuts, crispy and spicy.", shortDesc: "Masala roasted peanuts", price: 40, mrp: 50, stock: 4, unit: "200 g", isVeg: true, keywords: "peanuts, moongfali, masala, roasted" },
  { name: "Popcorn", categorySlug: "chips-namkeen", description: "Buttery salted popcorn, ready to eat. Movie-night essential.", shortDesc: "Buttery salted popcorn", price: 30, mrp: 35, stock: 3, unit: "60 g", isVeg: true, keywords: "popcorn, butter, salted, movie", bestSeller: true },

  // Chocolates & Sweets (21-29)
  { name: "Dairy Milk", categorySlug: "chocolates-sweets", description: "The classic creamy milk chocolate bar that melts in your mouth.", shortDesc: "Classic milk chocolate bar", price: 50, mrp: 55, stock: 5, unit: "50 g", isVeg: true, keywords: "dairy milk, cadbury, chocolate, milk", bestSeller: true, featured: true },
  { name: "Dairy Milk Silk", categorySlug: "chocolates-sweets", description: "Extra smooth and creamy premium milk chocolate for indulgent nights.", shortDesc: "Smooth premium silk chocolate", price: 95, mrp: 105, stock: 4, unit: "60 g", isVeg: true, keywords: "dairy milk, silk, cadbury, premium" },
  { name: "KitKat", categorySlug: "chocolates-sweets", description: "Crispy wafer fingers coated in milk chocolate. Take a break.", shortDesc: "Chocolate-coated wafer fingers", price: 40, mrp: 45, stock: 5, unit: "37.3 g", isVeg: true, keywords: "kitkat, wafer, chocolate, nestle", bestSeller: true },
  { name: "5 Star", categorySlug: "chocolates-sweets", description: "Chewy caramel and nougat covered in smooth milk chocolate.", shortDesc: "Chewy caramel chocolate bar", price: 20, mrp: 20, stock: 4, unit: "40 g", isVeg: true, keywords: "5 star, cadbury, caramel, nougat" },
  { name: "Perk", categorySlug: "chocolates-sweets", description: "Light crispy wafer coated in chocolate for a quick energy boost.", shortDesc: "Chocolate coated wafer bar", price: 20, mrp: 20, stock: 4, unit: "22 g", isVeg: true, keywords: "perk, cadbury, wafer, chocolate" },
  { name: "Munch", categorySlug: "chocolates-sweets", description: "Crunchy wafer layered with chocolaty coating.", shortDesc: "Crunchy chocolate wafer", price: 20, mrp: 20, stock: 4, unit: "22 g", isVeg: true, keywords: "munch, nestle, wafer, chocolate" },
  { name: "Gems", categorySlug: "chocolates-sweets", description: "Colourful sugar-coated chocolate buttons. Fun and crunchy.", shortDesc: "Colourful chocolate buttons", price: 20, mrp: 20, stock: 4, unit: "17.4 g", isVeg: true, keywords: "gems, cadbury, chocolate, buttons" },
  { name: "Snickers", categorySlug: "chocolates-sweets", description: "Peanuts, caramel and nougat in milk chocolate — you're not you when you're hungry.", shortDesc: "Peanut caramel chocolate bar", price: 45, mrp: 50, stock: 4, unit: "45 g", isVeg: true, keywords: "snickers, peanut, caramel, nougat", bestSeller: true },
  { name: "Melody / Toffee Packs", categorySlug: "chocolates-sweets", description: "Assorted caramel and chocolate-filled toffees, pack of multiple pieces.", shortDesc: "Caramel chocolate toffees", price: 50, mrp: 60, stock: 3, unit: "1 pack", isVeg: true, keywords: "melody, toffee, caramel, candy" },

  // Biscuits & Cookies (30-37)
  { name: "Parle-G", categorySlug: "biscuits-cookies", description: "The iconic golden glucose biscuits — a tea-time classic for every home.", shortDesc: "Classic glucose biscuits", price: 10, mrp: 10, stock: 5, unit: "80 g", isVeg: true, keywords: "parle g, glucose, biscuit, tea", bestSeller: true },
  { name: "Good Day", categorySlug: "biscuits-cookies", description: "Buttery cookies loaded with cashew and pistachio bits.", shortDesc: "Cashew butter cookies", price: 30, mrp: 30, stock: 5, unit: "75 g", isVeg: true, keywords: "good day, britannia, cashew, cookie" },
  { name: "Hide & Seek", categorySlug: "biscuits-cookies", description: "Chocolate chip cookies with a rich chocolaty flavour.", shortDesc: "Chocolate chip cookies", price: 40, mrp: 45, stock: 4, unit: "100 g", isVeg: true, keywords: "hide seek, parle, chocolate, cookie" },
  { name: "Bourbon", categorySlug: "biscuits-cookies", description: "Chocolate cream sandwich biscuits with a sugar-crusted top.", shortDesc: "Chocolate cream sandwich", price: 30, mrp: 35, stock: 4, unit: "100 g", isVeg: true, keywords: "bourbon, biscuit, chocolate, cream" },
  { name: "Oreo", categorySlug: "biscuits-cookies", description: "Twist, lick and dunk — chocolate sandwich cookies with vanilla cream.", shortDesc: "Vanilla cream chocolate cookies", price: 30, mrp: 35, stock: 5, unit: "120 g", isVeg: true, keywords: "oreo, cadbury, cookie, cream, chocolate", bestSeller: true },
  { name: "Marie Gold", categorySlug: "biscuits-cookies", description: "Light, crisp tea-time biscuits that go perfectly with chai.", shortDesc: "Light tea-time marie biscuits", price: 25, mrp: 30, stock: 3, unit: "100 g", isVeg: true, keywords: "marie gold, biscuit, tea, light" },
  { name: "Milk Bikis", categorySlug: "biscuits-cookies", description: "Milk cream sandwich biscuits — smooth and milky.", shortDesc: "Milk cream sandwich biscuits", price: 25, mrp: 30, stock: 3, unit: "100 g", isVeg: true, keywords: "milk bikis, britannia, cream, milk" },
  { name: "Cream Biscuits", categorySlug: "biscuits-cookies", description: "Assorted cream biscuits in chocolate, orange and vanilla flavours.", shortDesc: "Assorted cream biscuits", price: 25, mrp: 30, stock: 4, unit: "100 g", isVeg: true, keywords: "cream biscuits, chocolate, orange, vanilla" },

  // Instant Food (38-43)
  { name: "Maggi", categorySlug: "instant-food", description: "The iconic 2-minute masala noodles. The ultimate midnight hunger fix.", shortDesc: "2-minute masala noodles", price: 14, mrp: 14, stock: 5, unit: "70 g", isVeg: true, keywords: "maggi, noodles, instant, masala, 2 minute", bestSeller: true, featured: true },
  { name: "Yippee", categorySlug: "instant-food", description: "Long, slurpy instant noodles with classic masala flavour.", shortDesc: "Classic masala instant noodles", price: 14, mrp: 14, stock: 4, unit: "60 g", isVeg: true, keywords: "yippee, sunfeast, noodles, instant" },
  { name: "Cup Noodles", categorySlug: "instant-food", description: "Hot, spicy cup noodles — just add hot water, ready in 3 minutes.", shortDesc: "Instant cup noodles", price: 50, mrp: 55, stock: 4, unit: "70 g", isVeg: true, keywords: "cup noodles, instant, hot" },
  { name: "Instant Pasta", categorySlug: "instant-food", description: "Creamy tomato and cheese instant pasta, ready in minutes.", shortDesc: "Cheesy tomato instant pasta", price: 45, mrp: 50, stock: 3, unit: "65 g", isVeg: true, keywords: "pasta, instant, cheese, tomato" },
  { name: "Ready-to-Eat Snacks", categorySlug: "instant-food", description: "Heat-and-eat snacks like pav bhaji, poha and upma. Midnight hunger, solved.", shortDesc: "Heat-and-eat snack pack", price: 60, mrp: 70, stock: 3, unit: "1 pack", isVeg: true, keywords: "ready to eat, snack, pav bhaji, poha" },
  { name: "Ready-to-Eat Meals", categorySlug: "instant-food", description: "Full north-Indian meals — dal, rice, sabzi, ready in 3 minutes.", shortDesc: "Complete heat-and-eat meal", price: 99, mrp: 110, stock: 3, unit: "1 pack", isVeg: true, keywords: "ready to eat, meal, dal, rice, rajma" },

  // Drinks (44-53)
  { name: "Mineral Water 500 ml", categorySlug: "drinks-energy", description: "Chilled packaged drinking water, 500 ml.", shortDesc: "Packaged drinking water", price: 20, mrp: 20, stock: 5, unit: "500 ml", isVeg: true, keywords: "water, mineral, bisleri, aquafina" },
  { name: "Mineral Water 1 L", categorySlug: "drinks-energy", description: "Chilled packaged drinking water, 1 litre.", shortDesc: "Packaged drinking water 1L", price: 30, mrp: 30, stock: 4, unit: "1 L", isVeg: true, keywords: "water, mineral, bisleri, 1 litre" },
  { name: "Coca-Cola", categorySlug: "drinks-energy", description: "Ice-cold original taste sparkling soft drink.", shortDesc: "Original taste cold drink", price: 40, mrp: 40, stock: 5, unit: "750 ml", isVeg: true, keywords: "coca cola, coke, cold drink, soda", bestSeller: true },
  { name: "Pepsi", categorySlug: "drinks-energy", description: "Chilled refreshing cola with a bold, sweet taste.", shortDesc: "Refreshing cola drink", price: 40, mrp: 40, stock: 4, unit: "750 ml", isVeg: true, keywords: "pepsi, cola, cold drink, soda" },
  { name: "Sprite", categorySlug: "drinks-energy", description: "Clear lemon-lime sparkling drink with a crisp, clean taste.", shortDesc: "Lemon-lime clear drink", price: 40, mrp: 40, stock: 4, unit: "750 ml", isVeg: true, keywords: "sprite, lemon, lime, cold drink" },
  { name: "Fanta", categorySlug: "drinks-energy", description: "Bright, bubbly orange-flavoured sparkling drink.", shortDesc: "Orange flavoured cold drink", price: 40, mrp: 40, stock: 3, unit: "750 ml", isVeg: true, keywords: "fanta, orange, cold drink" },
  { name: "Limca / 7UP", categorySlug: "drinks-energy", description: "Zesty lemon sparkling soft drink (lemon/lime based on stock).", shortDesc: "Zesty lemon soft drink", price: 40, mrp: 40, stock: 4, unit: "750 ml", isVeg: true, keywords: "limca, 7up, lemon, lime, soda" },
  { name: "Packaged Juice", categorySlug: "drinks-energy", description: "Real-fruit packaged juice — mango, mixed fruit or orange (based on availability).", shortDesc: "Real fruit juice tetra pack", price: 30, mrp: 35, stock: 4, unit: "200 ml", isVeg: true, keywords: "juice, real, tropicana, mango, fruit" },
  { name: "Energy Drinks — Popular Brands", categorySlug: "drinks-energy", description: "Premium energy drink to keep you going through the night (popular brand based on stock).", shortDesc: "Premium energy drink", price: 125, mrp: 135, stock: 4, unit: "250 ml", isVeg: true, keywords: "energy drink, red bull, sting, caffeine", featured: true },
  { name: "Sports / Electrolyte Drinks", categorySlug: "drinks-energy", description: "Electrolyte-replenishing sports drink in refreshing orange/citrus flavour.", shortDesc: "Electrolyte sports drink", price: 40, mrp: 45, stock: 3, unit: "500 ml", isVeg: true, keywords: "sports, electrolyte, energy, rehydrate" },
];
