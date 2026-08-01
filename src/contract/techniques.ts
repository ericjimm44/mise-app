/**
 * CONTRACT — the technique library. Frozen. No agent may edit this file.
 *
 * This is the spine of the product. The recipe is disposable; these are what
 * the user actually keeps. Forty techniques, each with the mechanism behind it,
 * three honest levels, and the ways it goes wrong in a real kitchen.
 *
 * `videoUrl` is null for every entry in v1 — deliberately. One good "pan sauce"
 * clip will eventually serve four hundred recipes. The slot exists so that day
 * is data entry, not a refactor. Do not fill these with stock footage.
 *
 * technique_id values are permanent. Saved recipes and earned XP reference them
 * forever; renaming one silently orphans a user's progress.
 */

import type { Technique, TechniqueId } from './types';

export const TECHNIQUES: readonly Technique[] = [
  // -------------------------------------------------------------------------
  // HEAT
  // -------------------------------------------------------------------------
  {
    technique_id: 'maillard_sear',
    name: 'Maillard sear',
    family: 'heat',
    why_it_works:
      'Above roughly 140°C, amino acids and reducing sugars on a dry surface begin the Maillard reaction — a cascade that produces hundreds of new aromatic compounds that did not exist in the raw ingredient. It is not "browning" in the sense of colour; it is the manufacture of flavour. The reaction cannot begin while surface water remains, because evaporating water pins the surface at 100°C. This is why a wet surface steams and a dry one browns, and why patting dry is not fussiness but the whole technique.',
    levels: [
      { level: 1, label: 'learned', description: 'You pat the surface dry, wait for the pan to shimmer, and do not move the food for the first two minutes.' },
      { level: 2, label: 'practiced', description: 'You read the sound — an aggressive sizzle that settles — and judge crust by looking at the edge rather than lifting the piece.' },
      { level: 3, label: 'owned', description: 'You match pan size to food volume so the pan never drops out of the Maillard range, and you sear in batches without being told to.' },
    ],
    common_failure_modes: [
      'Crowding the pan — the released moisture drops the temperature and everything greys and steams.',
      'Moving the food too early, tearing the forming crust off and leaving it stuck to the pan.',
      'A pan that was never hot enough, so the food slowly heats through and never browns at all.',
      'Oil past its smoke point before the food goes in, giving an acrid burnt note through the whole dish.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'brown_butter',
    name: 'Brown butter (beurre noisette)',
    family: 'heat',
    why_it_works:
      'Butter is roughly 16% water and 1% milk solids suspended in fat. Heated, the water boils off first — the loud sputtering — and once it has gone the temperature climbs past 100°C and the milk proteins and lactose in the solids begin to Maillard and caramelise, dropping to the bottom as brown flecks. Those flecks carry a nutty, almost hazelnut aroma that plain butter does not have. The window between nutty and burnt is about thirty seconds, because the solids are already at the pan surface.',
    levels: [
      { level: 1, label: 'learned', description: 'You melt butter over medium heat, wait for the foam to subside, and pull it when it smells nutty.' },
      { level: 2, label: 'practiced', description: 'You swirl rather than stir, watch the solids rather than the liquid, and decant immediately into a cool bowl to stop carryover.' },
      { level: 3, label: 'owned', description: 'You brown to a chosen depth for a chosen purpose, and you use the fond-like solids deliberately instead of straining them out.' },
    ],
    common_failure_modes: [
      'Walking away — the gap between noisette and black is measured in seconds.',
      'Leaving it in the hot pan after it is done, so residual heat takes it past the point you pulled it.',
      'Using a dark pan where you cannot see the colour of the solids.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'braise',
    name: 'Braise',
    family: 'heat',
    why_it_works:
      'Tough cuts are tough because of collagen in the connective tissue. Held between roughly 70°C and 90°C in a moist environment for a long time, that collagen hydrolyses into gelatin — the same conversion that makes stock set in the fridge. Gelatin coats the palate and reads as richness, which is why a braise tastes "silky" in a way a quick-cooked lean cut never does. The liquid must stay below a rolling boil: at a hard boil, muscle fibres squeeze out moisture faster than gelatin forms, and you get meat that is simultaneously falling apart and dry.',
    levels: [
      { level: 1, label: 'learned', description: 'You brown the meat first, add liquid to partway up, cover, and hold it at a bare simmer until a fork meets no resistance.' },
      { level: 2, label: 'practiced', description: 'You judge doneness by feel rather than by the clock, and you reduce the braising liquid separately to build a sauce.' },
      { level: 3, label: 'owned', description: 'You braise a day ahead knowing it improves, lift the set fat cleanly from the cold surface, and adjust liquid depth to the cut in front of you.' },
    ],
    common_failure_modes: [
      'Boiling instead of simmering — stringy, dry meat sitting in a thin liquid.',
      'Drowning the meat, which dilutes the sauce and steams rather than braises the exposed surface.',
      'Skipping the initial sear, losing the fond that gives the sauce its backbone.',
      'Pulling it at "cooked" rather than at "tender" — collagen conversion needs time, not just temperature.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'shallow_fry',
    name: 'Shallow fry',
    family: 'heat',
    why_it_works:
      'Oil transfers heat far faster than air because it conducts and convects against the whole submerged surface at once. In shallow frying, the exposed top surface stays cooler, so you control cooking by flipping. The crust forms because oil above 160°C drives water out of the surface layer explosively — that vigorous bubbling is steam escaping, and it is what keeps oil from soaking in. When the bubbling slows dramatically, the surface has dried and browning is nearly done.',
    levels: [
      { level: 1, label: 'learned', description: 'You use enough oil to come a third up the food, and you turn once rather than fussing.' },
      { level: 2, label: 'practiced', description: 'You read the bubbling to judge progress and hold temperature by adjusting the burner between batches.' },
      { level: 3, label: 'owned', description: 'You keep oil in the right band without a thermometer and drain on a rack, not paper, so the underside stays crisp.' },
    ],
    common_failure_modes: [
      'Oil too cool — food absorbs it and turns greasy rather than crisp.',
      'Oil too hot — a dark crust over a raw interior.',
      'Adding cold food straight from the fridge and crashing the oil temperature.',
      'Draining on paper towel, which traps steam and softens the crust you just made.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'deep_fry',
    name: 'Deep fry',
    family: 'heat',
    why_it_works:
      'Full submersion cooks every surface simultaneously and holds the food in a 170–190°C bath where the outer millimetre dehydrates into a rigid, porous crust while the interior steams gently in its own moisture. The crust is essentially a dried, browned shell; it stays crisp only while its escaping steam keeps pressure outward. This is why fried food goes soft under a cover — trapped steam re-enters the crust and collapses its structure.',
    levels: [
      { level: 1, label: 'learned', description: 'You fry in small batches at a measured temperature and let the oil recover between them.' },
      { level: 2, label: 'practiced', description: 'You judge oil temperature by how fast a test piece bubbles and rises, and you salt the moment it comes out.' },
      { level: 3, label: 'owned', description: 'You use a double-fry for structural crispness, manage oil life, and never cover finished fried food.' },
    ],
    common_failure_modes: [
      'Overloading the pot, collapsing the temperature and producing greasy food.',
      'Wet food hitting hot oil, which spits violently and is genuinely dangerous.',
      'Filling the pot more than halfway — oil expands and foams when food goes in.',
      'Salting late, once the surface has cooled and salt no longer adheres.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'stir_fry_high_heat',
    name: 'High-heat stir fry',
    family: 'heat',
    why_it_works:
      'A stir fry works by keeping food in constant motion against a surface far hotter than any oven — so each piece takes brief, repeated contact with searing metal rather than sustained contact that would burn it. The pan must be hot enough that moisture released from the food flashes to steam and leaves immediately; otherwise liquid pools and the dish braises. Because contact time is short and total cooking time is a couple of minutes, everything must be cut, measured and within arm\'s reach before the pan is lit. There is no time to chop once it starts.',
    levels: [
      { level: 1, label: 'learned', description: 'You prep everything into bowls before heating the pan, and cook proteins and vegetables separately.' },
      { level: 2, label: 'practiced', description: 'You stage ingredients by cooking time and add sauce at the end, down the side of the hot pan so it caramelises on contact.' },
      { level: 3, label: 'owned', description: 'You keep the pan dry and roaring throughout, cooking in sequence in one vessel without anything stewing.' },
    ],
    common_failure_modes: [
      'Too much in the pan at once, so it releases liquid and stews into a grey braise.',
      'Adding sauce too early and boiling the ingredients in it.',
      'Chopping as you go — by the time the last item is ready the first is overcooked.',
      'Wet vegetables straight from washing, which flood the pan.',
    ],
    videoUrl: null,
  },

  // -------------------------------------------------------------------------
  // KNIFE
  // -------------------------------------------------------------------------
  {
    technique_id: 'knife_grip_claw',
    name: 'Pinch grip and claw hand',
    family: 'knife',
    why_it_works:
      'Pinching the blade just ahead of the handle puts your hand at the knife\'s balance point, so the blade becomes an extension of the forearm rather than a lever you are fighting. The guiding hand curls fingertips under, presenting knuckles to the blade face — the flat of the knife rides against the knuckles, which physically cannot be cut because they sit forward of the fingertips. Speed in a professional kitchen is a consequence of this geometry, not of bravado.',
    levels: [
      { level: 1, label: 'learned', description: 'You pinch the blade and curl your fingertips under, slowly and deliberately.' },
      { level: 2, label: 'practiced', description: 'The knuckle rides the blade face automatically and you no longer look at your guiding hand.' },
      { level: 3, label: 'owned', description: 'You work at speed with an unfamiliar knife without adjusting your grip consciously.' },
    ],
    common_failure_modes: [
      'Gripping the handle like a hammer, which forces the wrist to do work the arm should do.',
      'Flat fingertips on the food — the single most common way home cooks cut themselves.',
      'A dull knife requiring force, which is far more dangerous than a sharp one.',
      'A board that slides; a damp cloth underneath fixes it.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'uniform_dice',
    name: 'Uniform dice',
    family: 'knife',
    why_it_works:
      'Cooking rate scales with the ratio of surface area to volume, so pieces of different sizes finish at different times — always. A pan of unevenly diced onion contains some pieces that are burnt and some still raw at the moment you serve, and no amount of stirring fixes it. Uniformity is not aesthetic pedantry; it is the only way for a pan to reach doneness as one thing. The method — flat face down for stability, horizontal cuts, vertical cuts, then cross-cuts — exists because it produces uniformity fast.',
    levels: [
      { level: 1, label: 'learned', description: 'You create a flat face first so nothing rolls, then cut planks, batons, and finally cubes.' },
      { level: 2, label: 'practiced', description: 'Your dice is consistent enough that a pan browns evenly without rescue stirring.' },
      { level: 3, label: 'owned', description: 'You dice at speed to a size chosen for the cooking time you want, not the size you default to.' },
    ],
    common_failure_modes: [
      'Cutting a round vegetable without flattening a face first — it rolls, and rolling is how people get cut.',
      'Mixed sizes, giving simultaneously burnt and raw pieces.',
      'Sawing rather than slicing, which crushes cell walls and makes onion weep and taste harsh.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'julienne',
    name: 'Julienne',
    family: 'knife',
    why_it_works:
      'Long thin matchsticks have enormous surface area relative to their mass, so they cook in seconds and absorb dressing almost instantly. Julienne is the cut you choose when you want a vegetable to contribute texture and flavour without dominating volume, and it is the precursor to a fine dice. Squaring off the vegetable before cutting wastes a little but is what makes the sticks uniform.',
    levels: [
      { level: 1, label: 'learned', description: 'You square the vegetable, cut even planks, stack them, and slice into sticks.' },
      { level: 2, label: 'practiced', description: 'Your sticks are even enough to cook in one pass, and you keep the stack stable while cutting.' },
      { level: 3, label: 'owned', description: 'You julienne quickly and freehand, and know when a mandoline is genuinely faster than the knife.' },
    ],
    common_failure_modes: [
      'Planks of uneven thickness, guaranteeing uneven sticks downstream.',
      'A stack that slips mid-cut.',
      'Cutting so fine the vegetable turns to mush the moment it hits heat.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'chiffonade',
    name: 'Chiffonade',
    family: 'knife',
    why_it_works:
      'Stacking and rolling leaves, then slicing across the roll, gives fine ribbons with a minimum number of cut edges. This matters for delicate herbs like basil, whose cut cells release enzymes that oxidise and blacken on contact with air and steel — fewer, cleaner cuts mean less bruising and noticeably less blackening. A sharp blade and a single decisive pass is the difference between green ribbons and grey mush.',
    levels: [
      { level: 1, label: 'learned', description: 'You stack leaves, roll them tightly, and slice across the roll.' },
      { level: 2, label: 'practiced', description: 'You cut with one clean pass per slice and add the herb at the last possible moment.' },
      { level: 3, label: 'owned', description: 'You produce fine, unbruised ribbons quickly and adjust ribbon width to the dish.' },
    ],
    common_failure_modes: [
      'A dull knife bruising the leaf, turning basil black within a minute.',
      'Rolling loosely, so ribbons come out ragged and uneven.',
      'Cutting far in advance — the aroma is volatile and largely gone by service.',
    ],
    videoUrl: null,
  },

  // -------------------------------------------------------------------------
  // SAUCE
  // -------------------------------------------------------------------------
  {
    technique_id: 'pan_sauce',
    name: 'Pan sauce / fond deglaze',
    family: 'sauce',
    why_it_works:
      'The brown residue welded to the pan after searing — the fond — is concentrated Maillard product: the most flavour-dense material in the entire dish, and the thing most home cooks wash down the sink. Fond is largely water-soluble, so adding liquid and scraping dissolves it back into the sauce. Wine or stock also contributes acid and gelatin; the acid brightens, the gelatin gives body. This one technique is why restaurant plates taste finished and home plates often taste like their components.',
    levels: [
      { level: 1, label: 'learned', description: 'You pour off excess fat, add liquid to the hot pan, and scrape every brown speck loose with a wooden spoon.' },
      { level: 2, label: 'practiced', description: 'You reduce to the consistency you want, then finish off the heat with cold butter for gloss and body.' },
      { level: 3, label: 'owned', description: 'You build a balanced sauce from whatever is in the pan, adjusting acid and salt by taste without a recipe.' },
    ],
    common_failure_modes: [
      'Fond that was allowed to blacken rather than brown, making the sauce bitter with no way back.',
      'Leaving all the rendered fat in, giving a greasy sauce that will not emulsify.',
      'Adding butter while the pan is still hot, which breaks the emulsion into oil and solids.',
      'Reducing past the point of no return and ending up with something salty and sludgy.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'reduction',
    name: 'Reduction',
    family: 'sauce',
    why_it_works:
      'Simmering drives off water while everything dissolved in it stays behind, so flavour, salt and acid all concentrate together. This is why you salt at the end of a reduction and not the start — a sauce reduced by half from a properly seasoned base is twice as salty as you intended. Body increases too, because dissolved gelatin and sugars make up a larger fraction of what remains. Reduction is the cheapest intensity available in a kitchen: it costs only time and attention.',
    levels: [
      { level: 1, label: 'learned', description: 'You simmer uncovered and stop when the volume looks roughly right.' },
      { level: 2, label: 'practiced', description: 'You judge by how the sauce coats a spoon rather than by volume, and hold salt until the end.' },
      { level: 3, label: 'owned', description: 'You reduce to a target consistency for a specific plating purpose and know when to stop short and thicken another way.' },
    ],
    common_failure_modes: [
      'Seasoning early and ending with something inedibly salty.',
      'Reducing a sauce containing dairy at too high a heat, which curdles it.',
      'Reducing in a narrow pan — a wide surface evaporates far faster.',
      'Walking away at the end, when the last quarter reduces fastest.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'roux',
    name: 'Roux',
    family: 'sauce',
    why_it_works:
      'Flour thickens by gelatinising starch granules — they absorb water and swell. Dispersing the flour in fat first coats each granule so they hydrate individually rather than clumping into lumps the instant liquid arrives. Cooking the roux also drives off the raw-flour taste, and progressively browns it: the darker the roux, the more flavour and the less thickening power, because Maillard has broken down some of the starch. That trade-off is the whole reason a gumbo roux and a béchamel roux are different colours.',
    levels: [
      { level: 1, label: 'learned', description: 'You cook equal weights of fat and flour for a couple of minutes, then whisk in liquid gradually.' },
      { level: 2, label: 'practiced', description: 'You add liquid in stages, letting each fully incorporate, and you cook the sauce out so it does not taste of flour.' },
      { level: 3, label: 'owned', description: 'You take a roux to a chosen colour and compensate for its reduced thickening power without measuring.' },
    ],
    common_failure_modes: [
      'Dumping all the liquid in at once, producing lumps that no amount of whisking fixes.',
      'Under-cooking, leaving a pasty raw-flour taste through the finished dish.',
      'Burning the roux — black specks mean start again, it will be bitter.',
      'Expecting a dark roux to thicken like a pale one and ending up with soup.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'vinaigrette_emulsion',
    name: 'Vinaigrette emulsion',
    family: 'sauce',
    why_it_works:
      'Oil and vinegar do not mix; an emulsion is oil broken into droplets small enough to stay suspended in the vinegar. Whisking supplies the mechanical energy to shear the droplets, but they will recombine unless something stabilises the interface. Mustard is the usual answer — it contains mucilage and lecithin-like compounds that coat droplets and keep them apart. Adding the oil slowly matters because a small amount of oil in a lot of vinegar shears into fine droplets easily; dumping it in produces droplets too large to stay suspended.',
    levels: [
      { level: 1, label: 'learned', description: 'You whisk mustard into the acid first, then add oil in a thin stream while whisking.' },
      { level: 2, label: 'practiced', description: 'You balance the ratio by taste rather than by rule, and re-emulsify a split dressing by whisking it into fresh mustard.' },
      { level: 3, label: 'owned', description: 'You build stable emulsions from whatever acid and fat are present, and adjust for the specific leaf being dressed.' },
    ],
    common_failure_modes: [
      'Adding oil too fast, so it never emulsifies and sits in a slick on top.',
      'Omitting the emulsifier entirely and wondering why it splits within a minute.',
      'Over-acidifying — the standard three-to-one starting point exists for a reason.',
      'Dressing leaves too early, which draws out water and wilts them.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'monter_au_beurre',
    name: 'Mounting with butter (monter au beurre)',
    family: 'sauce',
    why_it_works:
      'Whisking cold butter into a warm sauce off the heat suspends butterfat as fine droplets stabilised by butter\'s own milk proteins and phospholipids, giving gloss and a rounded, coating texture. The butter must be cold and added gradually so it melts slowly enough to disperse rather than pooling as free oil. Above roughly 60°C the emulsion breaks: the proteins can no longer hold the fat and the sauce separates into grease and liquid. This is why the pan comes off the heat first — always.',
    levels: [
      { level: 1, label: 'learned', description: 'You take the pan off the heat and whisk in cold butter a cube at a time.' },
      { level: 2, label: 'practiced', description: 'You keep the sauce below a simmer throughout and recognise the moment it turns glossy.' },
      { level: 3, label: 'owned', description: 'You mount to a chosen richness and rescue a breaking sauce with a splash of cold liquid and vigorous whisking.' },
    ],
    common_failure_modes: [
      'Adding butter over direct heat, which breaks the sauce immediately.',
      'Room-temperature butter, which melts too fast to emulsify.',
      'Adding it all at once instead of cube by cube.',
      'Holding the finished sauce too hot before serving, so it splits while it waits.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'pasta_water_emulsion',
    name: 'Pasta water emulsion',
    family: 'sauce',
    why_it_works:
      'Water that has boiled pasta is loaded with leached starch. Those starch molecules act as an emulsifier and thickener, letting fat and water combine into a sauce that clings to the pasta instead of sliding off into a puddle. Finishing the pasta in the pan with fat and a ladle of that water, agitating hard, is what produces a glossy coating sauce — the agitation is not optional, it supplies the shear that forms the emulsion. This is why a truly good cacio e pepe has essentially four ingredients and is still hard.',
    levels: [
      { level: 1, label: 'learned', description: 'You reserve a mug of pasta water before draining and add it to the sauce.' },
      { level: 2, label: 'practiced', description: 'You finish the pasta in the sauce pan for the last minute, tossing hard, adding water until it coats.' },
      { level: 3, label: 'owned', description: 'You judge starch concentration and adjust water volume by eye to hit a consistency that holds from pan to plate.' },
    ],
    common_failure_modes: [
      'Draining without reserving any water — the single most common pasta mistake.',
      'Too much water in the pot, so the starch is too dilute to emulsify anything.',
      'Adding sauce to plated pasta rather than finishing them together in the pan.',
      'Not agitating enough — without shear it stays watery instead of turning creamy.',
    ],
    videoUrl: null,
  },

  // -------------------------------------------------------------------------
  // SEASONING
  // -------------------------------------------------------------------------
  {
    technique_id: 'dry_brine',
    name: 'Dry brine',
    family: 'seasoning',
    why_it_works:
      'Salt applied to a wet surface dissolves and draws moisture out by osmosis, forming a concentrated brine. That brine is then reabsorbed, carrying salt deep into the muscle, where it partially denatures proteins so they hold water more effectively during cooking. The result is meat seasoned throughout rather than only on the surface, and measurably juicier. Left uncovered in the fridge, the surface also dries — which is precisely the condition a Maillard sear needs. One technique, two payoffs.',
    levels: [
      { level: 1, label: 'learned', description: 'You salt the surface evenly and leave it at least forty minutes before cooking.' },
      { level: 2, label: 'practiced', description: 'You dry-brine uncovered in the fridge overnight for skin that crisps, and you do not salt again before searing.' },
      { level: 3, label: 'owned', description: 'You scale salt to weight rather than eyeballing, and match brining time to thickness and cut.' },
    ],
    common_failure_modes: [
      'Salting and cooking immediately — the surface is wet with drawn-out moisture, the worst possible moment to sear.',
      'Covering it tightly, which traps moisture and defeats the drying half of the technique.',
      'Salting again after brining, doubling the seasoning.',
      'Rinsing it off, which undoes the drying and adds surface water back.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'season_in_layers',
    name: 'Seasoning in layers',
    family: 'seasoning',
    why_it_works:
      'Salt added at each stage seasons that component from within — it has time to diffuse into the cell structure. Salt added only at the end sits on the surface and reads as sharp saltiness rather than depth, because your tongue meets a burst of sodium instead of an evenly seasoned bite. The same total quantity of salt tastes markedly different depending on when it went in. Layering is also the only way to taste and correct while there is still time to correct.',
    levels: [
      { level: 1, label: 'learned', description: 'You add a little salt at each stage rather than all of it at the end.' },
      { level: 2, label: 'practiced', description: 'You taste at every stage and adjust, rather than seasoning to a recipe quantity.' },
      { level: 3, label: 'owned', description: 'You season to the finished dish, accounting for reduction and for salty components arriving later.' },
    ],
    common_failure_modes: [
      'All the salt at the end, giving a dish that is simultaneously salty and flat.',
      'Salting each layer generously and compounding into something inedible.',
      'Forgetting that a reduction concentrates salt already present.',
      'Not tasting — seasoning is the one thing that cannot be done from a recipe.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'toast_whole_spices',
    name: 'Toasting whole spices',
    family: 'seasoning',
    why_it_works:
      'Spice aromatics are volatile oils locked inside cell structures. Dry heat ruptures those structures and drives off residual moisture, while low-level Maillard and caramelisation of the spice\'s own sugars generate new roasted compounds. The effect is not "more" of the same flavour but a broader, deeper one. It happens fast and it reverses fast: the same volatiles that are released are then lost to the air, so toasted spices should be ground and used promptly rather than stored.',
    levels: [
      { level: 1, label: 'learned', description: 'You toast whole spices in a dry pan over medium heat until they smell fragrant.' },
      { level: 2, label: 'practiced', description: 'You shake constantly, pull them the moment the aroma turns, and cool them before grinding.' },
      { level: 3, label: 'owned', description: 'You toast each spice for the time it needs rather than all together, and grind to order.' },
    ],
    common_failure_modes: [
      'Toasting mixed spices together when they have very different sizes and burn at different rates.',
      'Leaving them in the hot pan after removing from heat, so they scorch on residual heat.',
      'Burning them — bitter, and no way to recover.',
      'Toasting far ahead, losing the volatiles you just liberated.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'bloom_ground_spices',
    name: 'Blooming ground spices in fat',
    family: 'seasoning',
    why_it_works:
      'Most spice aroma compounds are fat-soluble, not water-soluble. Stirred into hot fat for thirty to sixty seconds, they dissolve into it and then distribute through the entire dish, because the fat carries them everywhere. The same spices added to a watery pot late stay largely undissolved and taste dusty and raw. This is why nearly every curry, chilli and spiced stew in the world begins with spices in oil rather than spices in liquid.',
    levels: [
      { level: 1, label: 'learned', description: 'You stir ground spices into hot fat for about thirty seconds before adding liquid.' },
      { level: 2, label: 'practiced', description: 'You bloom over lower heat and watch closely, adding liquid the moment the aroma peaks.' },
      { level: 3, label: 'owned', description: 'You sequence spices by how quickly they scorch and bloom them in stages.' },
    ],
    common_failure_modes: [
      'Heat too high — ground spices have huge surface area and burn in seconds.',
      'Blooming in a dry pan instead of fat, which just scorches them.',
      'Adding spices to liquid and getting a raw, dusty flavour.',
      'Blooming for too long, past aromatic into acrid.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'acid_balance',
    name: 'Balancing with acid',
    family: 'seasoning',
    why_it_works:
      'Acid does not primarily make food sour; in small amounts it sharpens the perception of every other flavour by contrast, much as salt does. A rich, fatty or long-cooked dish flattens on the palate because nothing interrupts it, and a squeeze of lemon or a splash of vinegar at the end restores definition. It works best added off the heat, because the volatile aromatic compounds in citrus and vinegar boil away quickly — cooked-in acid contributes sourness but loses the lift.',
    levels: [
      { level: 1, label: 'learned', description: 'You add a squeeze of lemon or a splash of vinegar at the end and taste the difference.' },
      { level: 2, label: 'practiced', description: 'You recognise "flat" as a symptom of missing acid rather than missing salt, and reach for the right one.' },
      { level: 3, label: 'owned', description: 'You choose the acid to suit the dish and dose it so the food tastes brighter without tasting sour.' },
    ],
    common_failure_modes: [
      'Adding more salt when the dish actually needs acid, which makes it salty and still flat.',
      'Adding acid early and boiling off exactly the aromatics that provide the lift.',
      'Overdoing it, tipping the dish from bright to sour with no way back.',
      'Using a harsh vinegar where a citrus would suit, or the reverse.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'salt_pasta_water',
    name: 'Salting pasta water',
    family: 'seasoning',
    why_it_works:
      'Pasta absorbs a substantial amount of water as it cooks, and whatever is dissolved in that water goes with it. Unsalted water produces pasta that is bland to its core, and no amount of sauce fixes that because sauce only ever coats the outside. Salt must go in before the pasta, so the absorbed water is already seasoned. The often-repeated claim that salt meaningfully raises the boiling point is false at culinary quantities — the reason to salt is seasoning, full stop.',
    levels: [
      { level: 1, label: 'learned', description: 'You salt the water generously before the pasta goes in, and taste it.' },
      { level: 2, label: 'practiced', description: 'You salt to a consistent strength every time and account for it in the sauce.' },
      { level: 3, label: 'owned', description: 'You adjust water volume and salt together to control both seasoning and the starch concentration you want for the sauce.' },
    ],
    common_failure_modes: [
      'Not salting at all — bland pasta that no sauce can rescue.',
      'Salting after the pasta is in, so much of the absorption has already happened unseasoned.',
      'Salting so heavily the finished dish is inedible once the sauce adds more.',
      'Adding oil to the water, which coats the pasta and stops sauce adhering.',
    ],
    videoUrl: null,
  },

  // -------------------------------------------------------------------------
  // EGG
  // -------------------------------------------------------------------------
  {
    technique_id: 'temper_eggs',
    name: 'Tempering eggs',
    family: 'egg',
    why_it_works:
      'Egg proteins begin to coagulate from around 65°C. Poured into a hot liquid directly, the outside of the egg mass hits that threshold instantly and sets into visible threads — scrambled egg in your sauce. Tempering raises the egg\'s temperature gradually by whisking in small amounts of the hot liquid, so the whole mass climbs together and stays below the setting point until it is diluted enough to thicken smoothly instead of curdling.',
    levels: [
      { level: 1, label: 'learned', description: 'You whisk hot liquid into the eggs a ladle at a time before returning the mixture to the pan.' },
      { level: 2, label: 'practiced', description: 'You whisk continuously and keep the pan below a simmer once the eggs are in.' },
      { level: 3, label: 'owned', description: 'You temper by feel, judge the moment it thickens, and pull it before it goes past.' },
    ],
    common_failure_modes: [
      'Pouring eggs straight into hot liquid — instant sweet scrambled egg.',
      'Adding the tempered mixture back over high heat and curdling it anyway.',
      'Stopping the whisking for even a few seconds at the wrong moment.',
      'Overshooting the set point; a custard goes from thickened to broken very quickly.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'hollandaise',
    name: 'Warm egg emulsion (hollandaise)',
    family: 'egg',
    why_it_works:
      'Egg yolk lecithin is a powerful emulsifier: it lets you suspend a large volume of butterfat in a small volume of water and yolk. Gentle heat is needed to partially denature the yolk proteins so they form a network that holds the structure, but the window is narrow — too cool and it never thickens, too hot and the proteins coagulate and the sauce breaks into scrambled egg and oil. This is the classic four-star technique: no recovery for the inattentive, but entirely reliable once the temperature discipline is understood.',
    levels: [
      { level: 1, label: 'learned', description: 'You whisk yolks and acid over gentle indirect heat, then add melted butter in a slow stream.' },
      { level: 2, label: 'practiced', description: 'You keep the bowl off direct heat, control temperature by lifting it away, and rescue a thickening-too-fast sauce with a splash of water.' },
      { level: 3, label: 'owned', description: 'You make it reliably without a double boiler and bring a broken sauce back by re-emulsifying into a fresh yolk.' },
    ],
    common_failure_modes: [
      'Too much heat, coagulating the yolks into visible curds.',
      'Adding butter too quickly, overwhelming the emulsifier before it can disperse the fat.',
      'Letting the finished sauce sit somewhere too warm, where it will break while it waits.',
      'Water in the bowl touching the simmering water below, which cooks the yolks from underneath.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'low_heat_scramble',
    name: 'Low-heat scramble',
    family: 'egg',
    why_it_works:
      'Egg proteins unfold and bond into a network as they heat; the tighter that network contracts, the more water it squeezes out. High heat makes it contract hard and fast, giving firm rubbery curds sitting in a puddle of expelled liquid. Low heat with constant agitation keeps curds small and the network loose, holding water in and producing a soft, custardy set. Because eggs carry over aggressively, the pan must come off the heat while they still look slightly underdone.',
    levels: [
      { level: 1, label: 'learned', description: 'You cook eggs over low heat, stirring constantly, and take them off while still glossy.' },
      { level: 2, label: 'practiced', description: 'You move the pan on and off the heat to control the rate, and account for carryover.' },
      { level: 3, label: 'owned', description: 'You produce a consistent curd size to order, and know when adding fat or dairy at the end helps and when it does not.' },
    ],
    common_failure_modes: [
      'Heat too high, giving rubbery curds weeping water onto the plate.',
      'Cooking to "done" in the pan, so carryover takes them past it on the plate.',
      'Salting long in advance, which begins breaking down proteins and thins the result.',
      'Not stirring enough, producing large tough curds instead of small soft ones.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'custard_set',
    name: 'Custard set control',
    family: 'egg',
    why_it_works:
      'A custard is a liquid thickened purely by egg proteins forming a loose three-dimensional mesh that traps water. The transition from "thickened" to "curdled" happens over just a few degrees, because once proteins bond to each other faster than they bond to water, the mesh contracts and expels liquid. Starch, sugar and fat all raise the curdling temperature by getting in the way of protein-protein bonding — which is why a pastry cream tolerates a boil while a crème anglaise does not.',
    levels: [
      { level: 1, label: 'learned', description: 'You cook custard gently and stop when it coats the back of a spoon.' },
      { level: 2, label: 'practiced', description: 'You draw a finger through the coating to check it holds a clean line, and strain as insurance.' },
      { level: 3, label: 'owned', description: 'You judge the set by viscosity and know how much heat a given custard formulation will tolerate.' },
    ],
    common_failure_modes: [
      'Overshooting into curdled — visible graininess that straining only partly hides.',
      'Cooking over direct high heat rather than gently.',
      'Not straining, so any small curds that did form end up in the finished dish.',
      'Leaving it in the hot pan after it is done, letting carryover take it over the edge.',
    ],
    videoUrl: null,
  },

  // -------------------------------------------------------------------------
  // VEGETABLE
  // -------------------------------------------------------------------------
  {
    technique_id: 'sweat_aromatics',
    name: 'Sweating aromatics',
    family: 'vegetable',
    why_it_works:
      'Sweating cooks onion, celery, carrot or leek over gentle heat with a little fat and often a pinch of salt, specifically to soften them and release their moisture without browning. The salt draws water out osmotically, that water keeps the surface temperature near 100°C, and below the Maillard threshold nothing browns. The point is to build a sweet, mellow foundation — browning here would produce a different, more assertive flavour that would dominate a delicate dish.',
    levels: [
      { level: 1, label: 'learned', description: 'You cook aromatics over low-medium heat with fat and a pinch of salt until translucent, not coloured.' },
      { level: 2, label: 'practiced', description: 'You use a lid or a splash of water to keep them from colouring, and give them the full time they need.' },
      { level: 3, label: 'owned', description: 'You decide sweat versus brown based on the dish, and hit either reliably.' },
    ],
    common_failure_modes: [
      'Heat too high, browning when you wanted sweet and neutral.',
      'Rushing it — undercooked onion stays sharp and is obvious in the finished dish.',
      'No salt, so the vegetables release moisture more slowly and colour before they soften.',
      'A crowded pan where the bottom layer browns while the top steams.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'caramelize_onions',
    name: 'Caramelising onions',
    family: 'vegetable',
    why_it_works:
      'Real caramelisation of onions is slow because it is two processes at once: water must evaporate, and then the onion\'s own sugars must break down and recombine through caramelisation and Maillard with the onion\'s amino acids. Both need sustained time above 110°C at a surface that is no longer wet. Recipes claiming ten minutes are describing browned onions, not caramelised ones — the difference is stark, and it is roughly forty minutes of stirring. A splash of water when the fond builds up deglazes it back in and prevents scorching.',
    levels: [
      { level: 1, label: 'learned', description: 'You cook sliced onions over medium-low heat, stirring regularly, for far longer than feels reasonable.' },
      { level: 2, label: 'practiced', description: 'You deglaze with a splash of water whenever the pan browns, and you do not raise the heat to rush it.' },
      { level: 3, label: 'owned', description: 'You take them to a chosen depth of colour and sweetness, and you know exactly how long it will take.' },
    ],
    common_failure_modes: [
      'Turning the heat up to save time, which burns edges while the centres stay raw.',
      'Stopping at ten minutes and calling golden onions caramelised.',
      'Letting the fond blacken instead of deglazing it back in.',
      'A crowded pan, so they steam in their own moisture and never dry out enough to brown.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'blanch_shock',
    name: 'Blanch and shock',
    family: 'vegetable',
    why_it_works:
      'A brief plunge into heavily boiling salted water sets chlorophyll and drives out the gases trapped between cells that make raw green vegetables look dull — which is why they go vividly green within seconds. Continue cooking and acids released from the cells convert chlorophyll to olive-brown pheophytin. The ice bath halts cooking instantly, locking in both colour and texture, and it makes the vegetable a component you can prepare well ahead and finish in seconds later.',
    levels: [
      { level: 1, label: 'learned', description: 'You boil heavily salted water, cook the vegetable briefly, and drop it straight into ice water.' },
      { level: 2, label: 'practiced', description: 'You use enough water that adding the vegetable does not stop the boil, and you dry thoroughly after shocking.' },
      { level: 3, label: 'owned', description: 'You blanch to a precise doneness knowing how it will finish later, and stage components ahead for a fast service.' },
    ],
    common_failure_modes: [
      'No ice bath — carryover keeps cooking and the colour dulls to army green.',
      'Too little water, so the boil stalls and the vegetable stews.',
      'Leaving them in the ice water too long, waterlogging them.',
      'Not drying after shocking, so they dilute whatever they go into next.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'dry_sear_mushrooms',
    name: 'Dry-searing mushrooms',
    family: 'vegetable',
    why_it_works:
      'Mushrooms are around 90% water and act like sponges. Add fat at the start and they absorb it, then release their water into the pan and stew in the resulting greasy liquid. Searing them in a dry hot pan first drives that water off; once it has gone the mushrooms shrink, the surface dries, and they brown properly. Fat added afterwards coats a browned surface rather than being soaked into a raw one. This inversion of the usual order is the single technique that separates good mushrooms from grey ones.',
    levels: [
      { level: 1, label: 'learned', description: 'You put mushrooms in a dry hot pan and wait for them to release and reabsorb their moisture before adding fat.' },
      { level: 2, label: 'practiced', description: 'You resist stirring until they have browned on one side, and you salt only after browning.' },
      { level: 3, label: 'owned', description: 'You judge by the sound and the shrink, and finish with fat and aromatics at exactly the right moment.' },
    ],
    common_failure_modes: [
      'Oil in the pan from the start, which the mushrooms absorb and turn greasy.',
      'Salting early, which draws water out before the pan can drive it off.',
      'Crowding, so they never get past the steaming phase.',
      'Stirring constantly, preventing any surface from staying in contact long enough to brown.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'high_heat_roast_veg',
    name: 'High-heat roasting',
    family: 'vegetable',
    why_it_works:
      'Roasting browns vegetables through caramelisation of their sugars and Maillard with their proteins, both of which need a surface above about 140°C. A moderate oven keeps the surface wet and near 100°C for too long, so the vegetable softens and dries without ever browning. High heat, a preheated tray, enough fat to conduct heat into the contact face, and — critically — space between pieces so escaping steam can leave rather than pooling, are what turn roast vegetables from beige to deeply browned.',
    levels: [
      { level: 1, label: 'learned', description: 'You use a hot oven, coat the vegetables in fat, and spread them in a single layer.' },
      { level: 2, label: 'practiced', description: 'You preheat the tray, cut to uniform size, and leave space between pieces.' },
      { level: 3, label: 'owned', description: 'You match cut size and oven position to the vegetable, and time additions so everything finishes together.' },
    ],
    common_failure_modes: [
      'Crowding the tray, trapping steam and producing pale soft vegetables.',
      'Oven too low, so they dry out before they brown.',
      'Not enough fat on the contact surface, giving patchy colour.',
      'Turning them too often, so no face stays down long enough to caramelise.',
    ],
    videoUrl: null,
  },

  // -------------------------------------------------------------------------
  // PROTEIN
  // -------------------------------------------------------------------------
  {
    technique_id: 'rest_meat',
    name: 'Resting meat',
    family: 'protein',
    why_it_works:
      'Heat makes muscle fibres contract and squeeze moisture toward the centre, where it sits under pressure. Cut immediately and that pressurised liquid runs out onto the board. During a rest the temperature gradient evens out, the fibres relax, and much of that liquid is reabsorbed and redistributed — so the same piece of meat loses substantially less on slicing. Resting also lets carryover finish the cooking, which is why the meat should come off the heat below its target temperature.',
    levels: [
      { level: 1, label: 'learned', description: 'You rest meat somewhere warm for several minutes before slicing.' },
      { level: 2, label: 'practiced', description: 'You scale rest time to thickness and tent loosely rather than wrapping tightly.' },
      { level: 3, label: 'owned', description: 'You plan the rest into the timeline, using it to finish sauce and vegetables so everything lands together.' },
    ],
    common_failure_modes: [
      'Slicing immediately and losing juice onto the board.',
      'Wrapping tightly in foil, which traps steam and softens any crust you built.',
      'Resting so long it goes cold, particularly on a cold plate.',
      'Not accounting for carryover, so a perfect internal temperature climbs past it during the rest.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'carryover_cooking',
    name: 'Carryover cooking',
    family: 'protein',
    why_it_works:
      'When food leaves the heat, its outer layers are far hotter than its centre, and that heat keeps flowing inward until the gradient equalises. Internal temperature therefore continues to rise after cooking stops — by a couple of degrees in a thin cut and by considerably more in a large roast. Cooking to your target temperature guarantees overshooting it. The whole skill is pulling early by the right margin, which depends on mass, on how hot the exterior got, and on how aggressive the cooking method was.',
    levels: [
      { level: 1, label: 'learned', description: 'You pull food off the heat a few degrees below your target and let it climb.' },
      { level: 2, label: 'practiced', description: 'You scale the margin to the size of the cut and the intensity of the heat.' },
      { level: 3, label: 'owned', description: 'You predict the final temperature reliably across cuts and methods, with or without a thermometer.' },
    ],
    common_failure_modes: [
      'Cooking to the target and finding it overcooked by the time it is cut.',
      'Applying the same margin to a thin steak and a whole roast.',
      'Leaving food in the hot pan to rest, which massively increases carryover.',
      'Not accounting for carryover in eggs and fish, where the window is smallest.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'render_skin_crisp',
    name: 'Rendering skin crisp',
    family: 'protein',
    why_it_works:
      'Skin is collagen, fat and water. Crisp skin requires driving out the water and rendering the fat out from between the collagen fibres, leaving a dry, rigid, glassy matrix. That takes sustained gentle contact rather than fierce heat — starting in a cold or barely warm pan lets fat render slowly before the outer surface sets, whereas a screaming pan seizes the surface immediately and traps water and unrendered fat underneath. Weight or pressure keeps the skin in full contact so it renders evenly rather than in patches.',
    levels: [
      { level: 1, label: 'learned', description: 'You start skin-side down in a cold pan over medium-low heat and let the fat render out slowly.' },
      { level: 2, label: 'practiced', description: 'You dry the skin thoroughly first, press it flat for even contact, and pour off rendered fat as it accumulates.' },
      { level: 3, label: 'owned', description: 'You render to a chosen crispness without overcooking the flesh beneath, finishing the second side briefly.' },
    ],
    common_failure_modes: [
      'A pan too hot at the start — the skin seizes, trapping fat and water beneath a set surface.',
      'Wet skin, which steams instead of rendering.',
      'Not pouring off rendered fat, so the skin shallow-fries unevenly.',
      'Flipping too early, before the fat has actually rendered out.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'reverse_sear',
    name: 'Reverse sear',
    family: 'protein',
    why_it_works:
      'A hot pan cooks from the outside in, producing a gradient — a grey overcooked band beneath the crust, tapering to the centre. Reverse searing inverts the order: bring the interior slowly to just under target in a low oven, so the whole mass arrives at temperature almost uniformly, then sear briefly at very high heat purely to build crust. Because the surface has also dried during the slow phase, the sear is faster and browns better, and the short contact time means the gradient barely has a chance to form.',
    levels: [
      { level: 1, label: 'learned', description: 'You cook low until just under target internal temperature, then sear hard and fast.' },
      { level: 2, label: 'practiced', description: 'You rest between the two stages and dry the surface before searing.' },
      { level: 3, label: 'owned', description: 'You choose reverse sear over conventional based on thickness, and time it so the sear finishes as everything else lands.' },
    ],
    common_failure_modes: [
      'Taking the low phase all the way to target, so the sear pushes it past.',
      'Searing a wet surface, which steams and delays crust formation.',
      'A sear pan that is not hot enough, so the sear takes long enough to overcook the interior.',
      'Using it on a cut too thin to benefit — under a certain thickness it offers nothing.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'velveting',
    name: 'Velveting',
    family: 'protein',
    why_it_works:
      'Coating sliced meat in a thin slurry — typically cornflour with a liquid, often with a little alkaline agent — does two things. The starch layer gelatinises on contact with heat and forms a physical barrier that slows moisture loss, and the mild alkalinity raises the meat\'s pH, which reduces how tightly proteins bind and contract. The result is meat that stays tender and silky through the brutal heat of a stir fry, which would otherwise seize and toughen thin slices in seconds.',
    levels: [
      { level: 1, label: 'learned', description: 'You toss sliced meat with cornflour and liquid and let it sit briefly before cooking.' },
      { level: 2, label: 'practiced', description: 'You get the coating thin and even, and cook the meat separately before returning it at the end.' },
      { level: 3, label: 'owned', description: 'You adjust the marinade to the cut and control alkalinity so it tenderises without leaving a soapy note.' },
    ],
    common_failure_modes: [
      'Too much starch, giving a gluey coating instead of a silky one.',
      'Too much alkaline agent, which produces a distinctly soapy taste.',
      'Cooking the meat through with the vegetables, negating the point of the barrier.',
      'Skipping the rest, so the coating has not hydrated and slides off in the pan.',
    ],
    videoUrl: null,
  },

  // -------------------------------------------------------------------------
  // DOUGH
  // -------------------------------------------------------------------------
  {
    technique_id: 'gluten_development',
    name: 'Gluten development',
    family: 'dough',
    why_it_works:
      'Wheat flour contains glutenin and gliadin. Hydrated and worked, they link into gluten — an elastic network that traps gas and gives bread its structure and chew. Kneading aligns and strengthens that network; time alone does much of the same work, which is why long autolyse and folding produce results similar to vigorous kneading. The windowpane test works because a properly developed network can be stretched thin enough to transmit light without tearing.',
    levels: [
      { level: 1, label: 'learned', description: 'You knead until the dough is smooth and springs back when pressed.' },
      { level: 2, label: 'practiced', description: 'You check with the windowpane test and use rest periods to let hydration do part of the work.' },
      { level: 3, label: 'owned', description: 'You judge development by feel and deliberately under- or over-develop to suit the crumb you want.' },
    ],
    common_failure_modes: [
      'Under-kneading, giving a dense crumb that will not hold its rise.',
      'Adding flour to fight stickiness, changing the hydration and toughening the result.',
      'Over-proofing after good development, so the network collapses under its own gas.',
      'Working a very high-hydration dough as though it were a stiff one.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'cold_fat_pastry',
    name: 'Cold fat pastry',
    family: 'dough',
    why_it_works:
      'Flaky pastry depends on discrete pieces of solid fat surviving intact into the oven. There they melt, and the water in both the fat and the dough turns to steam, forcing the surrounding dough layers apart — the flakes are those separated layers. If the fat warms and smears into the flour before baking, it coats the starch instead of sitting between layers, and you get something short and crumbly rather than flaky. Everything cold, worked fast, is not fussiness; it is the mechanism.',
    levels: [
      { level: 1, label: 'learned', description: 'You keep the fat and water cold, work quickly, and stop while visible pieces of fat remain.' },
      { level: 2, label: 'practiced', description: 'You chill the dough before rolling and again before baking, and handle it as little as possible.' },
      { level: 3, label: 'owned', description: 'You control flake size by the size of fat pieces you leave, and rescue warming dough by chilling mid-process.' },
    ],
    common_failure_modes: [
      'Warm hands or a warm room smearing the fat into the flour.',
      'Over-working, developing gluten and producing tough rather than tender pastry.',
      'Too much water, which also develops gluten and makes it shrink in the tin.',
      'Not chilling before baking, so the fat melts before the oven can turn its water to steam.',
    ],
    videoUrl: null,
  },

  // -------------------------------------------------------------------------
  // FINISHING
  // -------------------------------------------------------------------------
  {
    technique_id: 'nappe_consistency',
    name: 'Nappe consistency',
    family: 'finishing',
    why_it_works:
      'Nappe describes a sauce thick enough to coat the back of a spoon so that a finger drawn through leaves a clean line that holds. It matters because sauce consistency determines contact time with the palate: too thin and it runs off the food and pools, delivering flavour briefly and then not at all; too thick and it reads as gluey and mutes what is underneath. The spoon test is a viscosity measurement disguised as a kitchen trick, and it is far more reliable than any volume-based instruction.',
    levels: [
      { level: 1, label: 'learned', description: 'You test the sauce on a spoon and draw a finger through it to check the line holds.' },
      { level: 2, label: 'practiced', description: 'You adjust with reduction or liquid to hit the consistency rather than following a stated time.' },
      { level: 3, label: 'owned', description: 'You choose a target consistency for how the sauce will sit on the plate, allowing for how it thickens as it cools.' },
    ],
    common_failure_modes: [
      'Judging in the hot pan and forgetting the sauce thickens noticeably as it cools.',
      'Thinning a too-thick sauce with water and diluting the seasoning with it.',
      'Reducing past nappe into something sticky and over-seasoned.',
      'Serving a thin sauce that pools around the food instead of coating it.',
    ],
    videoUrl: null,
  },
  {
    technique_id: 'herb_finishing',
    name: 'Finishing with fresh herbs',
    family: 'finishing',
    why_it_works:
      'The compounds that make delicate herbs smell like themselves are highly volatile — they evaporate readily at cooking temperatures, which is why parsley simmered for twenty minutes contributes colour and almost no aroma. Adding them off the heat, at the last moment, preserves those volatiles so they reach the diner. Hardy herbs like rosemary, thyme and bay behave differently: their aromatics are less volatile and more tightly bound, so they benefit from long cooking. Knowing which is which is the technique.',
    levels: [
      { level: 1, label: 'learned', description: 'You add soft herbs at the very end, off the heat.' },
      { level: 2, label: 'practiced', description: 'You separate hardy herbs (early) from soft herbs (late) without being told.' },
      { level: 3, label: 'owned', description: 'You use stems and leaves at different stages, and cut soft herbs at the moment of use.' },
    ],
    common_failure_modes: [
      'Adding soft herbs early, so they blacken and lose all aroma.',
      'Cutting delicate herbs long in advance, letting the volatiles escape before service.',
      'Treating rosemary like parsley, producing something harsh and medicinal.',
      'Using a dull knife and bruising the leaves to a grey paste.',
    ],
    videoUrl: null,
  },
];

/** Fast membership check for VALIDATION RULE 3. */
export const TECHNIQUE_IDS: readonly TechniqueId[] = TECHNIQUES.map((t) => t.technique_id);

const BY_ID: ReadonlyMap<TechniqueId, Technique> = new Map(
  TECHNIQUES.map((t) => [t.technique_id, t]),
);

export function getTechnique(id: TechniqueId): Technique | undefined {
  return BY_ID.get(id);
}

export function techniquesByFamily(family: Technique['family']): readonly Technique[] {
  return TECHNIQUES.filter((t) => t.family === family);
}
