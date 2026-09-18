/* =====================================================================
   TRACKING — standalone menu section (full-width tile, same as Land and
   Farms). Species list -> tap a name -> popup with footprint/scat/sign
   guide. Content ported verbatim from the supplied UK Mammal & Deer
   Tracking Guide. Two content shapes: the 13 "sign" species (Footprints
   & Gait / Scat / Sex-Age Tells) and the 8 deer-family species (Key
   Identifying Features / Size / Common Habitat, plus their own
   Footprints/Scat/Sex-Age sections).
===================================================================== */

const TRACKING_DATA = {
  "Fox": { group: "huntable", sign: {
    "Footprints & Gait": "4 toes, claws register clearly, narrow oval/diamond outline — a straight line can be drawn between the front pad and the two leading toes without touching it. Direct-registering trotter: rear foot lands almost exactly in the front print, giving a near-straight single line of prints (\"perfect trotting line\"), especially in snow.",
    "Scat": "Twisted, rope-like, tapered/pointed at one or both ends, ~5–8cm long, about a pencil's width. Dark brown to black, often packed with fur, feathers, bone fragments, seeds. Strong musky \"foxy\" smell. Deliberately placed on raised objects (tussocks, molehills, logs, doorsteps) as territory markers.",
    "Sex / Age Tells": "Hard to sex from track/scat alone — dog fox prints average slightly larger/broader than a vixen's, but there's overlap. In late winter/spring, vixen scat/urine near a den may carry a strong \"cat-like\" ammonia tang. Cubs leave smaller, more rounded, less defined prints as pads are still soft."
  }},
  "Rabbit": { group: "huntable", sign: {
    "Footprints & Gait": "Front feet small and round; hind feet long and narrow. The classic pattern is a group of four prints — two larger hind prints land ahead and side-by-side, two small front prints behind — then a gap before the next group. This \"Y-shaped\" bounding cluster is the key ID feature versus a hare's similar but much larger, longer-strided pattern.",
    "Scat": "Small round pellets, ~8–10mm, finely chewed fibrous plant material, greenish-brown, dropped in scattered groups or concentrated latrines on mounds/tussocks at warren edges. Smaller and more spherical than deer pellets.",
    "Sex / Age Tells": "No reliable field sexing from sign. Juvenile prints are tiny and the four-print hop-cluster is much more tightly grouped; adult buck territories are marked with concentrated latrine piles and chin-rubbing near the warren."
  }},
  "Brown Rat": { group: "huntable", sign: {
    "Footprints & Gait": "4 toes on the front foot, 5 on the hind, each showing as distinct round pads (star-like arrangement), with a continuous tail-drag line frequently visible between prints in dust, mud or snow — one of the best ways to separate rat sign from similar small mammal tracks. Scurrying bound, narrow trail, hugging walls/edges.",
    "Scat": "Spindle/capsule-shaped, ~12–20mm, blunt-rounded ends, dark brown to black, found in scattered groups along regular runs, near food sources and burrow entrances.",
    "Sex / Age Tells": "Not reliably sexed from track/scat. Juvenile prints/droppings are proportionately smaller; a mixed size-range of droppings at one site usually signals a breeding colony with several age classes present."
  }},
  "Grey Squirrel": { group: "huntable", sign: {
    "Footprints & Gait": "Four toes on the front paw, five on the hind. Hind print ~35–45mm with three long narrow central toes flanking two shorter outer ones; front print smaller, ~30–35mm. Bounding gait gives a cluster of four prints — two larger hind ahead and side-by-side of two smaller front — mostly found on soft ground at the base of trees.",
    "Scat": "Small, roughly spherical, flattened at one end and pointed at the other, like a large grain of rice. Usually on branches, bird tables, stumps or fence posts. Feeding evidence is more obvious: hazelnuts split cleanly or gnawed with jagged edges, stripped pine cones, bark peeled in spiralling patches.",
    "Sex / Age Tells": "No reliable sexing from track or scat. Kits stay in the drey for the first 8–10 weeks, so anything seen on the ground/trees is juvenile or adult, not a very young kit."
  }},
  "Wild Boar": { group: "huntable", identity: {
    "Key Identifying Features": "Stocky, powerful build, coarse bristly coat, mane of longer bristles along the spine (more prominent in males). Large head, long straight snout, small erect ears. Males grow visible tusks from about 2 years old; females have tusks too but they don't protrude. Piglets (\"humbugs\") are ginger-brown with pale stripes.",
    "Size": "Males up to ~200kg, up to ~1m at shoulder; females smaller, up to ~130kg. Length 100–170cm plus a 16–30cm tail.",
    "Common Habitat": "Broadleaf and coniferous woodland, farmland edges. UK populations are feral, established mainly in the Forest of Dean, Kent/East Sussex border, Dorset, Somerset, and Dumfries & Galloway."
  }, sign: {
    "Footprints & Gait": "Cloven hoof print, wider and more rounded at the front than deer slots, with two dew-claw marks often registering behind the main cleaves. Adult male prints tend to be rounder with hooves held closer together; female prints more pointed and splayed at the front. Heavy, plodding walk, short fast bursts when startled.",
    "Scat": "Variable, tubular to segmented, dark and often loose/soft. Can look like large dog or badger scat. More reliable signs: rooting/rootling (ploughed-up soil), wallows (muddy hollows), rubbing posts (mud smeared on trunks near a wallow).",
    "Sex / Age Tells": "Boars are up to ~10% larger, stockier, with a darker spinal mane in winter and visibly protruding tusks from about 2 years old. Sows are highly social, living in family groups (\"sounders\"); mature boars are largely solitary outside the rut."
  }},
  "Feral Goat": { group: "huntable", identity: {
    "Key Identifying Features": "Similar size to a sheep but leaner. Coat white, black, brown or mixed, often shaggier than a sheep's fleece. Both sexes carry horns. Billies are larger, bearded, with a strong smell during the rut; nannies smaller, unbearded, no odour.",
    "Size": "Billies up to ~91cm at shoulder, up to ~55kg; nannies smaller, up to ~35kg.",
    "Common Habitat": "Rocky, steep, coastal and upland terrain — cliffs, crags, scrubby hillsides. Scattered feral populations in Scotland, Wales, and parts of England (Lynton/Valley of Rocks, the Cheviots, Snowdonia)."
  }, sign: {
    "Footprints & Gait": "Cloven hoof, similar size/shape to a sheep's or a small deer's — the hardest UK hoofprint to separate on shape alone. Gap between cleaves more V-shaped than a sheep's rounder gap. Sure-footed on steep/broken terrain sheep and most deer wouldn't go — terrain is often the best clue.",
    "Scat": "Small, dark, oval/round pellets, genuinely difficult to separate from deer pellets by eye. Habitat (steep, rocky, scrubby ground) is the more practical way to rule goat in or out.",
    "Sex / Age Tells": "Billies visibly larger, bearded, often stained/darker around the head from scent-marking in the rut, with a strong smell. Nannies smaller, unbearded. Both sexes carry horns from young, growing throughout life — a rough, non-precise age guide."
  }},
  "Red Deer": { group: "deer", identity: {
    "Key Identifying Features": "Largest UK land mammal. Reddish-brown coat in summer, greyer-brown in winter. Pale cream rump patch with no dark border, short tail. Stags carry large, multi-tined branching antlers (up to 16 points). Hinds notably smaller, no antlers.",
    "Size": "Stags: 107–137cm at shoulder, 90–190kg. Hinds: 107–122cm at shoulder, 63–120kg.",
    "Common Habitat": "Open moorland and Highlands (Scotland's main stronghold), also Exmoor, Lake District, Peak District, East Anglia; woodland-edge and open hill ground."
  }, sign: {
    "Footprints & Gait": "Large, unmistakable slots. Stag forefoot ~8–9cm long, 6–7cm wide; hind forefoot ~6–7cm long, 4–5cm wide — the biggest sex size-gap of any UK deer. Pointed front to each cleave; can be confused with sheep/goat but deer slots are sharper-pointed.",
    "Scat": "Large, 20–25mm x 13–18mm, cylindrical/acorn-shaped, pointed at one end, rounded/concave at the other. Black and shiny when fresh, duller brown with age.",
    "Sex / Age": "Stags carry antlers, cast/regrown annually, generally larger with more points as they mature (around 8–10 years). Hinds unantlered. Calves (May–June) are spotted and lie hidden for the first couple of weeks. Older stags develop a heavier neck mane, especially in the autumn rut."
  }},
  "Roe Deer": { group: "deer", identity: {
    "Key Identifying Features": "Small, elegant, reddish coat in summer turning grey/slate in winter, white chin, black nose, prominent white rump patch (no visible tail). Bucks have short, upright, roughened antlers, usually 3 points each.",
    "Size": "Up to about 25kg; shoulder height roughly 60–75cm.",
    "Common Habitat": "Open woodland with rides/clearings/edges, also farmland with hedgerow cover; usually alone or in small groups."
  }, sign: {
    "Footprints & Gait": "Dainty, small slots, ~4–5cm long, 3–4cm wide for either sex — little size difference between buck and doe. Pointed cleave tips.",
    "Scat": "Small, 10–14mm x 7–10mm, cylindrical, shiny near-black when fresh. Can be confused with rabbit droppings, but roe pellets are more oval/tapered and greyer-toned.",
    "Sex / Age": "Bucks grow short, rough-textured antlers each year, does have none — the clearest sex cue outside the \"buttonhead\" stage. Kids (May–June, usually twins) are spotted and hide in cover for the first few weeks."
  }},
  "Fallow Deer": { group: "deer", identity: {
    "Key Identifying Features": "Medium-sized. Coat varies — tawny with white spots in summer is most common, also black, \"menil\" and white forms. Long tail with black central stripe. Bucks have the only palmate (flattened, shovel-like) antlers of any UK deer.",
    "Size": "Bucks up to 94cm at shoulder, 46–80kg; does up to 91cm at shoulder, 35–52kg.",
    "Common Habitat": "Deciduous woodland, conifer plantations, parkland, farmland edges; often in single-sex or mixed herds."
  }, sign: {
    "Footprints & Gait": "Slots 50–80mm long, 35–50mm wide, narrower and more pointed than red deer's. Buck: ~6.5–8cm long, 4–5cm wide; doe: ~5–6cm long, 3–4cm wide.",
    "Scat": "10–15mm x 8–12mm, oval, similar shape to red deer's but smaller; black turning brown with age.",
    "Sex / Age": "Only bucks have antlers, and only fallow bucks have the palmate shape. Fawns (June) are spotted and lie up in cover. Older bucks show heavier, broader palmation each year."
  }},
  "Sika Deer": { group: "deer", identity: {
    "Key Identifying Features": "Very similar to red deer (they interbreed) but noticeably smaller. White spots on coat in summer; thick, often dark, almost black coat in winter. Stags have antlers similar to red deer's but smaller/less branched.",
    "Size": "Stags: 1.07–1.22m at shoulder; body length 1.2–1.9m (male), 1.1–1.6m (female).",
    "Common Habitat": "Prefers denser woodland cover than red deer; found in Scotland, Lake District, Lancashire, Dorset/New Forest area, East Anglia."
  }, sign: {
    "Footprints & Gait": "Slots similar to red deer but smaller (~7cm) and narrower — very similar to fallow slots too, often slightly shorter and broader.",
    "Scat": "10–15mm x 8–12mm, glossy black, one end flat/indented or rounded, the other pointed.",
    "Sex / Age": "Stags carry antlers, hinds do not. Fawns spotted like red deer calves. Sika interbreed with red deer where ranges overlap — coat pattern and rump patch shape (more heart-shaped/white, dark line down the middle) are the most reliable non-antler clues."
  }},
  "Reeves' Muntjac": { group: "deer", identity: {
    "Key Identifying Features": "Small, stocky, hunched-looking with an arched back, reddish-brown coat, large rounded ears. Bucks have short backward-curving antlers plus visible upper canine tusks; does lack antlers but show small tusks and a dark V/diamond marking on the forehead. No defined breeding season.",
    "Size": "Bucks 44–52cm at shoulder, 10–18kg; does 43–52cm at shoulder, 9–16kg.",
    "Common Habitat": "Dense woodland understorey and scrub, increasingly gardens/urban fringe; solitary/territorial."
  }, sign: {
    "Footprints & Gait": "Small, delicate slots, around 2.5–3cm long, 2cm wide — noticeably smaller than roe. Often place left/right prints almost in one line as they thread through dense cover.",
    "Scat": "Small, 10–13mm x 5–11mm, black, rounded or cylindrical; tends to scatter on hitting the ground rather than staying in a neat pile.",
    "Sex / Age": "Both sexes show small tusk-like canines, but only bucks carry antlers (small backward-pointing spikes, present most of the year). Young born year-round, spotted like other fawns but seen at almost any time of year."
  }},
  "Chinese Water Deer": { group: "deer", identity: {
    "Key Identifying Features": "Small, sandy-brown coat, large rounded \"teddy-bear\" ears, round black nose, no antlers in either sex — bucks have long downward-curving canine tusks instead. No visible tail, no obvious rump patch. Rut in December, the latest of any British deer.",
    "Size": "Slightly larger than muntjac; broadly similar shoulder height to muntjac/roe.",
    "Common Habitat": "Strongly associated with wetlands, reed beds, river/fen edges (Cambridgeshire fens, Norfolk Broads, Whipsnade area); largely solitary."
  }, sign: {
    "Footprints & Gait": "Slots intermediate between muntjac and roe, typically 4–5cm long, 3–4cm wide. Cleaves roughly equal length with straight inner edges.",
    "Scat": "10–15mm long, 5–10mm wide, cylindrical, pointed at one end. Usually small, loose, scattered piles rather than aggregated.",
    "Sex / Age": "Absence of antlers in both sexes means the tell is the tusks — visible in bucks, absent/barely visible in does. Fawns (May–June, often larger litters) spotted at birth."
  }},
  "Badger": { group: "reference", sign: {
    "Footprints & Gait": "Very broad, almost rectangular print — 5 forward-pointing toes above a large wide central pad, with long prominent claw marks set noticeably ahead of the toe pads. Rolling, pigeon-toed, waddling gait; well-used paths show an obvious packed-earth \"badger trod.\"",
    "Scat": "Deposited in shallow scraped pits (\"dung pits\"/latrines), usually on territory boundaries. Variable consistency depending on diet, but the pit itself is the most reliable ID feature versus fox scat, left in the open unburied.",
    "Sex / Age Tells": "Little reliable sexing from prints. Boars average slightly larger front feet/claws than sows. Cubs (spring) leave small, faint prints clustered right around the sett entrance."
  }},
  "Otter": { group: "reference", sign: {
    "Footprints & Gait": "5 rounded toes fanned in an arc above a large central pad, often asymmetric. Claws usually register as small pricks. A tail-drag mark is a strong confirming sign, especially on muddy banks and slipways.",
    "Scat (Spraint)": "Distinctive — dark, twisted, often crumbly, left conspicuously on prominent spots to mark territory. Fresh spraint smells like jasmine tea or fish oil, packed with fish scales/crayfish fragments.",
    "Sex / Age Tells": "Dog otters have noticeably larger feet than bitches — front pad width is a commonly used field measure. Cub prints much smaller, often in tight clusters near a holt entrance."
  }},
  "Hedgehog": { group: "reference", sign: {
    "Footprints & Gait": "Broad, hand-like print, 5 toes, \"thumb\" toe angled outward. Small claw pricks ahead of each toe. Shuffling/waddling gait with a short stride.",
    "Scat": "Small, dark, shiny, sausage/cylinder-shaped, often slightly twisted, commonly containing shiny bits of beetle wing-case.",
    "Sex / Age Tells": "Not distinguishable by track or scat. Juvenile prints (from hoglets, active from around July) are noticeably smaller and shallower."
  }},
  "Weasel": { group: "reference", sign: {
    "Footprints & Gait": "Tiny 5-toed prints, roughly circular, claws often visible as fine pricks. The UK's smallest mammal track. Classic 2x2 bounding mustelid gait, often weaving erratically.",
    "Scat": "Very small, thin, twisted, often dark and greasy-looking, frequently containing fur and bone fragments. Deposited on prominent stones/logs/path junctions as scent posts.",
    "Sex / Age Tells": "Females noticeably smaller than males, so a consistently very small track is more likely female. Kits leave even smaller, less-defined prints, staying close to the nest site."
  }},
  "Stoat": { group: "reference", sign: {
    "Footprints & Gait": "Same basic 5-toed shape as weasel but clearly larger (roughly double), with a more convoluted, lobed heel pad. Same bounding gait but a longer bound length matching its bigger size.",
    "Scat": "Twisted and tapered like other mustelids, larger than weasel scat, often containing rabbit fur.",
    "Sex / Age Tells": "Males run notably larger than females, giving a rough sex indicator from track size. A stoat in white winter coat (\"ermine\") is a seasonal, not age, cue."
  }},
  "Polecat": { group: "reference", sign: {
    "Footprints & Gait": "Broader, more elongated 5-toed print than stoat/weasel, with a large well-defined central pad — very close to a feral ferret's print, essentially not distinguishable from ferret sign in the field.",
    "Scat": "Dark, twisted, musky-smelling (a particularly strong scent gland odour), often left near dens/burrows rather than widely scattered.",
    "Sex / Age Tells": "No reliable field distinction. Males larger than females so bigger prints suggest a male (hob). Cannot be reliably told apart from an escaped/feral ferret by track or scat alone."
  }},
  "American Mink": { group: "reference", sign: {
    "Footprints & Gait": "5 star-like, splayed toes with sharp claws, slight webbing. Toes splay more distinctly than polecat's tighter rounded pad group. Regularly swims, so tracks often appear right at the waterline.",
    "Scat": "Twisted, dark, often greenish or containing crayfish/fish/bird remains, with a strong unpleasant/musky smell — key way to separate from otter spraint, which smells sweeter.",
    "Sex / Age Tells": "Males substantially larger than females, so print size is a useful sex indicator. Kits seen as a cluster of smaller tracks near a den in early summer."
  }},
  "Dog (comparison)": { group: "reference", sign: {
    "Footprints & Gait": "4 toes with claws, rounder and broader than fox, front pad larger. Registers less neatly than a fox — rear foot often falls short or overlaps messily, and the trail wanders rather than forming one straight line.",
    "Scat": "Uniform tubular shape, blunt ends, fairly homogeneous texture, size/consistency varies hugely with the individual dog.",
    "Sex / Age Tells": "Not reliably sexed. Larger, broader prints generally indicate a bigger/older dog; puppy prints small, soft-edged, bounding rather than steady trotting."
  }},
  "Cat (comparison)": { group: "reference", sign: {
    "Footprints & Gait": "4 toes, no claw marks (retracted), very round print with a tri-lobed rear pad edge. Direct register like a fox but rounder and smaller, never a claw mark.",
    "Scat": "Small, segmented, tapered — often buried (look for a scraped-over patch), less commonly found in the open than fox scat.",
    "Sex / Age Tells": "No reliable distinction. Kitten prints tiny (often under 2cm) with faint pad definition; entire toms scent-mark with sprayed urine rather than scat."
  }},
};

const TRACKING_ORDER = [
  "Fox", "Rabbit", "Brown Rat", "Grey Squirrel", "Wild Boar", "Feral Goat",
  "Red Deer", "Roe Deer", "Fallow Deer", "Sika Deer", "Reeves' Muntjac", "Chinese Water Deer",
  "Badger", "Otter", "Hedgehog", "Weasel", "Stoat", "Polecat", "American Mink",
  "Dog (comparison)", "Cat (comparison)",
];

const Tracking = {
  open() {
    const overlay = document.getElementById("modalOverlay");
    const rows = TRACKING_ORDER.map((name) => {
      const isRef = TRACKING_DATA[name].group === "reference";
      return `<button class="tracking-row${isRef ? " tracking-row-ref" : ""}" onclick="Tracking.openSpecies('${name.replace(/'/g, "\\'")}')">${name}</button>`;
    }).join("");

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>Tracking Guide</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <p class="hint">Footprints, scat, and sex/age tells for game species, plus common non-quarry species for comparison.</p>
        <div class="tracking-list">${rows}</div>
      </div>`;
    overlay.classList.remove("hidden");
  },

  openSpecies(name) {
    const data = TRACKING_DATA[name];
    const overlay = document.getElementById("modalOverlay");
    const sections = { ...(data.identity || {}), ...(data.sign || {}) };
    const body = Object.entries(sections)
      .map(([heading, text]) => `<h4>${heading}</h4><p>${text}</p>`)
      .join("");

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="Tracking.open()">← Back</button>
          <h3>${name}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div class="tracking-detail">${body}</div>
      </div>`;
    overlay.classList.remove("hidden");
  },
};
