// Wicked Chkn authoritative menu seed data — transcribed from the printed menu card.
export const CATEGORIES = [
  'Burgers & Sandwiches', 'Burritos & Quesadillas', 'Wicked Wedges',
  'Chicken Snacks', 'Drinks'
];

export const MENU = [
  // Burgers & Sandwiches — every burger is served with wedges
  { id: 'double-mutton-cheese', name: 'Double Mutton Cheese Burger', category: 'Burgers & Sandwiches', price: 369, veg: false, inStock: true, popular: true, desc: 'Two juicy mutton patties, molten cheese, served with wedges. The house heavyweight.' },
  { id: 'philly-pork-cheese', name: 'Philly Pork Cheese Burger', category: 'Burgers & Sandwiches', price: 299, veg: false, inStock: true, popular: true, desc: 'Philly-style pulled pork under a cheese melt, served with wedges.' },
  { id: 'fried-chicken-burger', name: 'Fried Chicken Burger', category: 'Burgers & Sandwiches', price: 299, veg: false, inStock: true, desc: 'Crunchy fried chicken fillet, house slaw, served with wedges.' },
  { id: 'grilled-chicken-burger', name: 'Grilled Chicken Burger', category: 'Burgers & Sandwiches', price: 349, veg: false, inStock: true, desc: 'Char-grilled chicken breast, lighter but loaded, served with wedges.' },
  { id: 'spicy-paneer-burger', name: 'Spicy Crispy Paneer Burger', category: 'Burgers & Sandwiches', price: 299, veg: true, inStock: true, spicy: true, popular: true, desc: 'Crispy paneer slab in fire dust with cooling mayo, served with wedges.' },
  { id: 'bbq-chicken-sandwich', name: 'BBQ Chicken Sandwich', category: 'Burgers & Sandwiches', price: 349, veg: false, inStock: true, desc: 'Smoky BBQ chicken stacked on toasted bread, served with wedges.' },
  { id: 'harrisa-chicken-foccacia', name: 'Harrisa Chicken on Foccacia', category: 'Burgers & Sandwiches', price: 349, veg: false, inStock: true, spicy: true, desc: 'North-African harrisa chicken on herbed foccacia, served with wedges.' },
  { id: 'harrisa-veg-foccacia', name: 'Harrisa Veg on Foccacia', category: 'Burgers & Sandwiches', price: 349, veg: true, inStock: true, spicy: true, desc: 'Harrisa-spiced grilled veggies on foccacia, served with wedges.' },
  // Burritos & Quesadillas — filled with cheese, veggies, beans and rice
  { id: 'mutton-burrito', name: 'Mutton Burrito', category: 'Burritos & Quesadillas', price: 429, veg: false, inStock: true, desc: 'Fat burrito packed with mutton, cheese, beans and rice.' },
  { id: 'pork-burrito', name: 'Pork Burrito', category: 'Burritos & Quesadillas', price: 369, veg: false, inStock: true, desc: 'Slow-cooked pork rolled with cheese, veggies, beans and rice.' },
  { id: 'chicken-burrito', name: 'Chicken Burrito', category: 'Burritos & Quesadillas', price: 349, veg: false, inStock: true, popular: true, desc: 'The crowd favourite — chicken, cheese, beans and rice, wrapped tight.' },
  { id: 'paneer-burrito', name: 'Paneer Burrito', category: 'Burritos & Quesadillas', price: 349, veg: true, inStock: true, desc: 'Tandoori paneer with cheese, beans and rice in a warm tortilla.' },
  { id: 'mushroom-burrito', name: 'Crispy Mushroom Burrito', category: 'Burritos & Quesadillas', price: 349, veg: true, inStock: true, desc: 'Crispy-fried mushrooms, cheese, beans and rice. Veg, but wicked.' },
  { id: 'quesadilla', name: 'Quesadilla (Veg / Pork / Fajita Chicken)', category: 'Burritos & Quesadillas', price: 299, veg: false, inStock: true, desc: 'Toasted cheese-pull quesadilla — pick veg, pork or fajita chicken in the note.' },
  // Wicked Wedges
  { id: 'wicked-wedges', name: 'Wicked Wedges + Special Sauce', category: 'Wicked Wedges', price: 149, veg: true, inStock: true, popular: true, desc: 'Our signature crispy wedges with the special sauce. The namesake.' },
  { id: 'loaded-wedges', name: 'Wickedly Loaded Wedges (Veg / Non-Veg)', category: 'Wicked Wedges', price: 249, veg: true, inStock: true, desc: 'Wedges buried under cheese and toppings — choose veg or non-veg in the note.' },
  // Chicken Snacks
  { id: 'popcorn-chicken', name: 'Spicy Popcorn Chicken', category: 'Chicken Snacks', price: 199, veg: false, inStock: true, spicy: true, desc: 'Poppable fried chicken bites with a spicy dust.' },
  { id: 'chicken-tenders', name: 'Spicy Chicken Tenders', category: 'Chicken Snacks', price: 249, veg: false, inStock: true, spicy: true, popular: true, desc: 'Hand-breaded tenders, fried hot and spiced harder.' },
  { id: 'chicken-wings', name: "Crispy Chicken Wing's (Mild / Hot)", category: 'Chicken Snacks', price: 249, veg: false, inStock: true, spicy: true, desc: 'Double-crisped wings — mild or hot, pick your poison in the note.' },
  // Drinks
  { id: 'iced-tea-lemon', name: 'Lemon Iced Tea', category: 'Drinks', price: 99, veg: true, inStock: true, desc: 'Fresh-brewed, citrusy, ice cold.' },
  { id: 'iced-tea-peach', name: 'Peach Iced Tea', category: 'Drinks', price: 99, veg: true, inStock: true, desc: 'Sweet peach over cold black tea.' },
  { id: 'iced-tea-mellow', name: 'Mellow Yellow Iced Tea', category: 'Drinks', price: 99, veg: true, inStock: true, desc: 'Our mellow house blend — smooth and easy.' },
  { id: 'iced-tea-apple', name: 'Green Apple Iced Tea', category: 'Drinks', price: 99, veg: true, inStock: true, desc: 'Tart green apple with a cold tea kick.' },
  { id: 'water', name: 'Packaged Water', category: 'Drinks', price: 50, veg: true, inStock: true, desc: 'Cold bottled water.' }
];

// per-category modifier sets (priced customization)
export const MODIFIER_SETS = {
  burger: [
    { name: 'Make it Double', price: 60 },
    { name: 'Make it Triple', price: 130 },
    { name: 'Extra cheese', price: 30 },
    { name: 'No onions', price: 0 },
    { name: 'Extra spicy', price: 0 }
  ],
  burrito: [
    { name: 'Extra cheese', price: 30 },
    { name: 'Extra filling', price: 50 },
    { name: 'Make it spicy', price: 0 }
  ],
  wedges: [
    { name: 'Extra special sauce', price: 30 },
    { name: 'Cheese sauce', price: 40 },
    { name: 'Peri-peri dust', price: 15 }
  ],
  snacks: [
    { name: 'Extra dip', price: 40 },
    { name: 'Make it hot', price: 0 }
  ],
  drinks: [
    { name: 'Less ice', price: 0 },
    { name: 'Extra lemon', price: 10 }
  ]
};

export const modsForCategory = (category) => {
  if (category === 'Burritos & Quesadillas') return MODIFIER_SETS.burrito;
  if (category === 'Wicked Wedges') return MODIFIER_SETS.wedges;
  if (category === 'Chicken Snacks') return MODIFIER_SETS.snacks;
  if (category === 'Drinks') return MODIFIER_SETS.drinks;
  return MODIFIER_SETS.burger;
};

export const RULES = {
  openHour: 11, closeHour: 22,
  deliveryFee: 35, deliveryRadiusKm: 7,
  eta: { dinein: '15–20 min', pickup: '25–30 min', delivery: '35–40 min' }
};

// Full stage names per order type — from the prototype's backend.js FLOWS
// (supersedes the shorter STATUS_FLOWS in the original menu-data.js).
export const FLOWS = {
  dinein: ['Order placed', 'Order accepted', 'Being made', 'Ready to serve'],
  pickup: ['Order placed', 'Order accepted', 'Being made', 'Ready', 'Picked up'],
  delivery: ['Order placed', 'Order accepted', 'Being made', 'Ready', 'Out for delivery', 'Delivered']
};
