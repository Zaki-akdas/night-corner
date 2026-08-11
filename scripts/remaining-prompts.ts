// Ready-to-run image generation prompts for the remaining 33 Night Corner products.
// Once the image-generation limit resets, call generate_image for each entry
// (5 per batch is the practical parallel limit). Files are saved directly into
// the per-product gallery folders; the gallery DB column auto-detects them.
//
// Run via the image-generation tool in batches of 5:
//   generate_image(file_path = "/home/user/public/images/products/<slug>/1.jpg",
//                  prompt = PROMPTS[slug])

export const PROMPTS: Record<string, string> = {
  // ── Chocolates & Sweets (9) ──
  "dairy-milk":
    "Professional commercial product photography of a purple foil-wrapped milk chocolate bar with broken creamy milk chocolate squares around it, dark navy reflective surface, purple neon rim light, dramatic studio lighting, premium chocolate e-commerce, photorealistic, no text",
  "dairy-milk-silk":
    "Professional commercial product photography of a premium glossy purple wrapped silky smooth milk chocolate bar with flowing melted chocolate silk, dark surface with purple and gold neon lighting, luxury chocolate, photorealistic, no text",
  kitkat:
    "Professional commercial product photography of red wrapped chocolate wafer fingers with crispy wafer layers visible, broken pieces, dark surface with red neon glow, dramatic studio lighting, premium chocolate wafer, photorealistic, no text",
  "5-star":
    "Professional commercial product photography of a golden wrapped chewy caramel nougat chocolate bar with pieces showing gooey caramel, dark surface with gold and amber neon lighting, premium candy bar, photorealistic, no text",
  perk:
    "Professional commercial product photography of a blue wrapped chocolate-coated wafer bar with crispy wafer visible in broken pieces, dark surface with blue neon lighting, premium chocolate snack, photorealistic, no text",
  munch:
    "Professional commercial product photography of a blue purple wrapped crunchy chocolate wafer bar, broken pieces showing wafer layers, dark surface with blue neon glow, dramatic studio light, photorealistic, no text",
  gems:
    "Professional commercial product photography of colorful sugar-coated chocolate buttons spilling from a small packet, vibrant candy coated chocolates in red blue green yellow orange, dark surface with colorful neon bokeh, playful premium candy, photorealistic, no text",
  snickers:
    "Professional commercial product photography of a brown wrapped peanut caramel nougat chocolate bar, cut piece showing peanuts and caramel layers, dark surface with amber neon glow, dramatic studio lighting, premium candy bar, photorealistic, no text",
  "melody-toffee-packs":
    "Professional commercial product photography of a pile of wrapped caramel chocolate toffees in glossy colorful wrappers, a few unwrapped showing golden caramel, dark surface with warm amber lighting, premium candy, photorealistic, no text",

  // ── Biscuits & Cookies (8) ──
  "parle-g":
    "Professional commercial product photography of a classic glucose biscuit packet with golden rectangular biscuits stacked and scattered, dark surface with warm white neon glow, dramatic studio lighting, premium biscuit e-commerce, photorealistic, no text",
  "good-day":
    "Professional commercial product photography of a butter cookie packet with golden cashew cookies stacked, visible cashew nuts on cookies, dark surface with warm yellow neon light, premium cookies, photorealistic, no text",
  "hide-seek":
    "Professional commercial product photography of a dark chocolate chip cookie packet, chocolate chip cookies stacked with melted chocolate chips, dark surface with brown neon glow, premium cookies, photorealistic, no text",
  bourbon:
    "Professional commercial product photography of chocolate cream sandwich biscuits stacked, sugar-dusted chocolate biscuits with cream filling visible, dark surface with chocolate brown neon light, premium biscuits, photorealistic, no text",
  oreo:
    "Professional commercial product photography of black chocolate sandwich cookies with white cream filling stacked and twisted apart, cookie crumbs, dark surface with blue neon rim light, premium cookies, photorealistic, no text",
  "marie-gold":
    "Professional commercial product photography of light golden tea-time marie biscuits stacked on a plate, crisp plain biscuits, dark surface with warm white lighting, premium biscuit, photorealistic, no text",
  "milk-bikis":
    "Professional commercial product photography of cream sandwich biscuits with smooth milk cream filling, golden biscuits stacked, dark surface with warm cream neon light, premium biscuits, photorealistic, no text",
  "cream-biscuits":
    "Professional commercial product photography of assorted cream biscuits in chocolate orange and vanilla flavors stacked, colorful cream fillings visible, dark surface with colorful neon glow, premium biscuits, photorealistic, no text",

  // ── Instant Food (6) ──
  maggi:
    "Professional commercial food photography of a steaming bowl of cooked masala instant noodles with fork twirling noodles, a red yellow instant noodle packet beside, dark moody surface with red neon rim light, steam rising, late night hunger food, photorealistic, no text",
  yippee:
    "Professional commercial food photography of a bowl of long slurpy instant noodles with masala, an orange noodle packet beside, chopsticks, dark surface with orange neon glow, steam, photorealistic, no text",
  "cup-noodles":
    "Professional commercial product photography of a paper cup of hot instant noodles with visible vegetables and steam rising, fork in cup, dark surface with red neon lighting, late night snack, photorealistic, no text",
  "instant-pasta":
    "Professional commercial food photography of a bowl of creamy tomato cheese instant pasta with a pasta packet beside, fork twirling pasta, dark surface with red neon glow, cheesy sauce, photorealistic, no text",
  "ready-to-eat-snacks":
    "Professional commercial food photography of a heated ready-to-eat Indian snack like pav bhaji in a bowl with buttered pav bread, a retort pouch packet beside, dark moody surface with warm orange neon light, steam, photorealistic, no text",
  "ready-to-eat-meals":
    "Professional commercial food photography of a complete ready-to-eat Indian meal tray with dal rice sabzi and roti, a food pouch beside, dark surface with warm neon lighting, late night meal, photorealistic, no text",

  // ── Drinks & Energy (10) ──
  "mineral-water-500-ml":
    "Professional commercial product photography of a clear plastic water bottle 500ml with condensation droplets and blue label, water splash, dark navy surface with blue neon rim light, chilled and refreshing, photorealistic, no text",
  "mineral-water-1-l":
    "Professional commercial product photography of a large 1 liter clear plastic water bottle with condensation, water splash, dark surface with blue neon glow, chilled, photorealistic, no text",
  "coca-cola":
    "Professional commercial product photography of a classic contoured glass cola bottle filled with dark cola, condensation droplets, ice cubes and splash, dark surface with red neon rim light, refreshing cold drink, photorealistic, no text",
  pepsi:
    "Professional commercial product photography of a blue labeled cola bottle with condensation, ice cubes, cola splash, dark surface with blue neon lighting, cold refreshing drink, photorealistic, no text",
  sprite:
    "Professional commercial product photography of a clear lemon-lime soft drink in a green-tinted bottle with condensation, lemon slices and ice, dark surface with green and blue neon glow, refreshing, photorealistic, no text",
  fanta:
    "Professional commercial product photography of an orange colored fizzy soft drink in a bottle with condensation, orange slices and ice cubes, orange bubbles, dark surface with orange neon light, photorealistic, no text",
  "limca-7up":
    "Professional commercial product photography of a clear lemon-lime fizzy soft drink in a green bottle with condensation, lemon slices, ice, bubbles, dark surface with green neon glow, refreshing, photorealistic, no text",
  "packaged-juice":
    "Professional commercial product photography of a tetra pack of fruit juice with a glass of juice and fruit slices (mango or mixed fruit), condensation, dark surface with orange yellow neon light, fresh and refreshing, photorealistic, no text",
  "energy-drinks-popular-brands":
    "Professional commercial product photography of a tall silver and blue energy drink can with condensation, electric blue liquid splash and lightning effects, dark surface with electric blue neon glow, premium energy drink, photorealistic, no text",
  "sports-electrolyte-drinks":
    "Professional commercial product photography of an orange sports drink in a clear bottle with condensation, orange slices and ice, electrolyte bubbles, dark surface with orange neon light, hydrating, photorealistic, no text",
};

export const TOTAL_REMAINING = Object.keys(PROMPTS).length; // 33
