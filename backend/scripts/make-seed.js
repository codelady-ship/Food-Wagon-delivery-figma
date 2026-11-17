// One-off generator for data/seed.json (kept for transparency; you can also edit seed.json directly).
// Run: node scripts/make-seed.js
const fs = require("fs");
const path = require("path");

const R = (slug, name, cuisines, priceLevel, rating, ratingCount, deliveryTime, deliveryFee, opensAt, closesAt, image, alt, address, description, discount = 0, fast = false) => ({
  slug, name, cuisines, priceLevel, rating, ratingCount, deliveryTime, deliveryFee, opensAt, closesAt,
  image: `images/${image}.webp`, alt, address, description, discount, fast,
});

const restaurants = [
  R("golden-fork-bistro", "Golden Fork Bistro", ["italian", "dessert"], 2, 4.6, 128, 30, 2.5, "10:00", "23:00", "rest-bistro", "Candle-lit bistro table with plated dinner", "28 Nizami St, Baku", "Neighbourhood Italian bistro with wood-fired pizza, fresh pasta and house-made desserts.", 20, true),
  R("urban-loft-kitchen", "Urban Loft Kitchen", ["asian", "chicken", "dessert"], 2, 4.4, 96, 35, 2.5, "09:00", "23:00", "rest-loft", "Modern restaurant loft with dark wooden tables", "5 Rashid Behbudov St, Baku", "Modern loft kitchen mixing Asian street food, grilled chicken and brunch classics.", 15),
  R("market-hall-grill", "Market Hall Grill", ["burger", "chicken", "healthy"], 1, 4.2, 210, 20, 1.5, "11:00", "22:00", "rest-hall", "Bright food hall with wooden chairs and red lamps", "12 Fizuli St, Baku", "Busy food-hall grill for smash burgers, crispy chicken and hearty bowls.", 0, true),
  R("sea-breeze-terrace", "Sea Breeze Terrace", ["asian", "healthy", "drinks"], 3, 4.7, 84, 40, 3, "10:00", "00:00", "rest-terrace", "Seaside restaurant terrace with blue chairs", "Seaside Boulevard 3, Baku", "Seaside terrace serving sushi, fresh salads and cold-pressed juices.", 10),
  R("tokyo-noodle-bar", "Tokyo Noodle Bar", ["asian", "chicken", "drinks"], 2, 4.5, 152, 25, 2, "12:00", "23:30", "ramen", "Bowl of ramen with egg and shrimp", "41 Samad Vurgun St, Baku", "Small ramen counter with slow-cooked broths, sushi rolls and yakitori.", 0, true),
  R("green-bowl-co", "Green Bowl Co.", ["healthy", "chicken", "drinks"], 1, 4.3, 61, 20, 1.5, "08:00", "21:00", "salad", "Colourful salad bowl seen from above", "9 Uzeyir Hajibeyov St, Baku", "Salad and grain bowls with fresh juices, open from breakfast.", 5),
  R("napoli-slice", "Napoli Slice", ["italian"], 1, 4.1, 176, 25, 1.5, "11:00", "02:00", "pizza", "Sliced pizza with vegetables", "77 Ataturk Ave, Baku", "Late-night pizza by the slice or whole, with dough proofed for 48 hours.", 0, true),
  R("sweet-corner-bakery", "Sweet Corner Bakery", ["dessert", "drinks"], 1, 4.8, 43, 15, 1, "08:00", "20:00", "pancakes", "Stack of pancakes with syrup and berries", "2 Khagani St, Baku", "Family bakery for pancakes, brownies and fresh juice, baked every morning."),
];

const D = (slug, name, restaurant, price, cat, img, alt, description, popular = false) => ({
  slug, name, restaurant, price, cat, image: `images/${img}.webp`, alt, description, popular,
});

const dishes = [
  D("veggie-pizza", "Veggie Pizza", "golden-fork-bistro", 12.5, "italian", "pizza", "Sliced pizza with vegetables", "Tomato, mozzarella, peppers, olives and basil on a wood-fired base.", true),
  D("penne-arrabbiata", "Penne Arrabbiata", "golden-fork-bistro", 10.5, "italian", "pasta", "Penne pasta in spicy tomato sauce", "Penne in a garlicky chilli-tomato sauce with parsley.", true),
  D("bistro-meatballs", "Bistro Meatballs", "golden-fork-bistro", 11.5, "italian", "meatballs", "Meatballs with greens", "Beef meatballs in tomato sauce with rocket and parmesan."),
  D("chocolate-brownie", "Chocolate Brownie", "golden-fork-bistro", 5.5, "dessert", "brownie", "Chocolate brownie squares", "Dark chocolate brownie with a soft centre.", true),
  D("shrimp-ramen", "Shrimp Ramen", "urban-loft-kitchen", 11, "asian", "ramen", "Ramen bowl with shrimp and egg", "Miso broth, noodles, shrimp, soft egg and spring onion.", true),
  D("grilled-chicken-skewers", "Grilled Chicken Skewers", "urban-loft-kitchen", 13.5, "chicken", "skewers", "Grilled chicken skewers", "Marinated chicken thigh skewers with herb yoghurt.", true),
  D("maple-pancakes", "Maple Pancakes", "urban-loft-kitchen", 7.5, "dessert", "pancakes", "Pancakes with syrup", "Three fluffy pancakes, maple syrup and berries."),
  D("loft-fried-chicken", "Loft Fried Chicken", "urban-loft-kitchen", 9.5, "chicken", "chicken", "Crispy fried chicken pieces", "Buttermilk fried chicken with a sweet-chilli dip."),
  D("classic-cheeseburger", "Classic Cheeseburger", "market-hall-grill", 9.9, "burger", "burger", "Cheeseburger with lettuce and tomato", "Smash beef patty, cheddar, pickles and house sauce.", true),
  D("double-smash-burger", "Double Smash Burger", "market-hall-grill", 12.9, "burger", "burger", "Double cheeseburger", "Two smash patties, double cheddar and caramelised onion."),
  D("crispy-fried-chicken", "Crispy Fried Chicken", "market-hall-grill", 8.9, "chicken", "chicken", "Crispy fried chicken pieces", "Six pieces of crunchy fried chicken with fries.", true),
  D("meatballs-and-greens", "Meatballs and Greens", "market-hall-grill", 11.5, "healthy", "meatballs", "Meatballs with greens", "Lean beef meatballs over a big green salad."),
  D("salmon-sushi-set", "Salmon Sushi Set", "sea-breeze-terrace", 15, "asian", "sushi", "Salmon sushi set", "12 pieces: salmon nigiri, maki and avocado rolls.", true),
  D("rainbow-salad-bowl", "Rainbow Salad Bowl", "sea-breeze-terrace", 9.5, "healthy", "salad", "Colourful salad bowl", "Quinoa, avocado, beetroot, corn and lemon dressing.", true),
  D("fresh-orange-juice", "Fresh Orange Juice", "sea-breeze-terrace", 3.9, "drinks", "juice", "Glass of orange juice", "Freshly squeezed oranges, 330 ml."),
  D("seaside-poke-bowl", "Seaside Poke Bowl", "sea-breeze-terrace", 13.9, "healthy", "hero-bowl", "Poke bowl with salmon", "Salmon, rice, edamame, mango and sesame."),
  D("tonkotsu-ramen", "Tonkotsu Ramen", "tokyo-noodle-bar", 12, "asian", "ramen", "Ramen bowl", "Rich bone broth, chashu, soft egg and nori.", true),
  D("california-roll", "California Roll", "tokyo-noodle-bar", 9, "asian", "sushi", "Sushi rolls", "8 pieces with crab, avocado and cucumber."),
  D("teriyaki-chicken", "Teriyaki Chicken Skewers", "tokyo-noodle-bar", 10.5, "chicken", "skewers", "Chicken skewers", "Yakitori skewers glazed with teriyaki."),
  D("yuzu-lemonade", "Yuzu Lemonade", "tokyo-noodle-bar", 4.2, "drinks", "juice", "Glass of lemonade", "Sparkling lemonade with yuzu citrus."),
  D("green-goddess-bowl", "Green Goddess Bowl", "green-bowl-co", 8.9, "healthy", "salad", "Green salad bowl", "Kale, cucumber, avocado, seeds and herb dressing.", true),
  D("salmon-power-bowl", "Salmon Power Bowl", "green-bowl-co", 12.5, "healthy", "hero-bowl", "Salmon bowl", "Baked salmon, brown rice, greens and miso dressing."),
  D("chicken-grain-bowl", "Chicken Grain Bowl", "green-bowl-co", 10.5, "chicken", "skewers", "Grilled chicken", "Grilled chicken, bulgur, roasted vegetables and tahini."),
  D("cold-pressed-orange", "Cold-pressed Orange", "green-bowl-co", 4.5, "drinks", "juice", "Orange juice", "Orange, carrot and ginger, cold pressed."),
  D("margherita-pizza", "Margherita Pizza", "napoli-slice", 9.5, "italian", "pizza", "Pizza", "Tomato, fior di latte and basil.", true),
  D("pepperoni-pizza", "Pepperoni Pizza", "napoli-slice", 11.5, "italian", "pizza", "Pizza", "Tomato, mozzarella and spicy beef pepperoni."),
  D("spaghetti-meatballs", "Spaghetti and Meatballs", "napoli-slice", 10.9, "italian", "meatballs", "Meatballs", "Spaghetti with beef meatballs in tomato sauce."),
  D("garlic-penne", "Garlic Butter Penne", "napoli-slice", 8.5, "italian", "pasta", "Pasta", "Penne tossed in garlic butter and parmesan."),
  D("berry-pancakes", "Berry Pancakes", "sweet-corner-bakery", 6.9, "dessert", "pancakes", "Pancakes", "Pancakes with mixed berries and whipped cream.", true),
  D("fudge-brownie", "Fudge Brownie", "sweet-corner-bakery", 4.5, "dessert", "brownie", "Brownie", "Gooey fudge brownie with walnuts."),
  D("brownie-sundae", "Brownie Sundae", "sweet-corner-bakery", 6.5, "dessert", "brownie", "Brownie", "Warm brownie, vanilla ice cream and caramel."),
  D("morning-juice", "Morning Juice", "sweet-corner-bakery", 3.5, "drinks", "juice", "Juice", "Fresh orange and apple juice."),
];

const promos = [
  { code: "WELCOME10", type: "percent", value: 10, minSubtotal: 15, description: "10% off orders over $15" },
  { code: "FREESHIP", type: "free_delivery", value: 0, minSubtotal: 10, description: "Free delivery on orders over $10" },
  { code: "BIG5", type: "fixed", value: 5, minSubtotal: 40, description: "$5 off orders over $40" },
];

const reviews = [
  ["golden-fork-bistro", "Leyla", 5, "The veggie pizza arrived hot and the crust was still crisp."],
  ["golden-fork-bistro", "Murad", 4, "Great pasta. Delivery took a bit longer on Friday night."],
  ["market-hall-grill", "Aysel", 4, "Solid burger for the price, fries could be crispier."],
  ["sea-breeze-terrace", "Kamran", 5, "Sushi set was fresh and nicely packed."],
  ["tokyo-noodle-bar", "Nigar", 5, "Broth packed separately, so the noodles stayed perfect."],
  ["sweet-corner-bakery", "Elvin", 5, "Best brownies in town, ordered twice this week."],
  ["green-bowl-co", "Sabina", 4, "Healthy and filling. Would love more dressing options."],
  ["napoli-slice", "Rauf", 4, "Good late-night pizza, delivered at 1 am without issues."],
].map(([restaurant, authorName, rating, comment]) => ({ restaurant, authorName, rating, comment }));

fs.writeFileSync(path.join(__dirname, "../data/seed.json"), JSON.stringify({ restaurants, dishes, promos, reviews }, null, 2) + "\n");
console.log("seed.json:", restaurants.length, "restaurants,", dishes.length, "dishes");
