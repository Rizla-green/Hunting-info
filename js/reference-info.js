/* =====================================================================
   REFERENCE INFO — ported verbatim from v3.9, sourced from The Deer
   Initiative, BASC, the Food Standards Agency, and Natural England/
   GOV.UK. Not veterinary or legal advice — always check the official
   source for anything current/binding.
===================================================================== */

// ---------- Close seasons ----------
function ewniSeasons(includeRoeCwd) {
  const base = {
    "Red deer":    { male: "1 Aug – 30 Apr", female: "1 Nov – 31 Mar" },
    "Fallow deer": { male: "1 Aug – 30 Apr", female: "1 Nov – 31 Mar" },
    "Sika deer":   { male: "1 Aug – 30 Apr", female: "1 Nov – 31 Mar" },
    "Muntjac":     { male: "No close season", female: "No close season" },
  };
  base["Roe deer"] = includeRoeCwd
    ? { male: "1 Nov – 31 Mar (open 1 Apr – 31 Oct)", female: "1 Nov – 31 Mar" }
    : { male: "N/A", female: "N/A" };
  base["Chinese water deer"] = includeRoeCwd
    ? { male: "1 Nov – 31 Mar", female: "1 Nov – 31 Mar" }
    : { male: "N/A", female: "N/A" };
  return base;
}
const CLOSE_SEASON = {
  "England": ewniSeasons(true),
  "Wales": ewniSeasons(true),
  "Northern Ireland": ewniSeasons(false),
  "Scotland": {
    "Red deer":    { male: "No close season", female: "21 Oct – 15 Feb" },
    "Fallow deer": { male: "No close season", female: "21 Oct – 15 Feb" },
    "Sika deer":   { male: "No close season", female: "21 Oct – 15 Feb" },
    "Roe deer":    { male: "No close season", female: "21 Oct – 31 Mar" },
    "Chinese water deer": { male: "N/A", female: "N/A" },
    "Muntjac":     { male: "N/A", female: "N/A" },
  },
};

// ---------- Lymph nodes ----------
const DEER_LYMPH_NODES = [
  { name: "Retropharyngeal nodes", location: "In the head, deep in the throat behind the pharynx. If not visible once the head is off, pull the tongue back as far as possible then cut down and across the back of the jaw to expose them." },
  { name: "Sub-maxillary (submandibular) nodes", location: "Just inside the corner of the jaw, close to the skin — slide a knife along the underside of the jawbone, or peel the skin back from the centre, to find them." },
  { name: "Bronchial nodes", location: "In the chest, on either side of the windpipe close to the top of the lungs. The pair usually differ slightly in size and position from each other." },
  { name: "Mediastinal nodes", location: "In the chest, on the top side of the lungs, close to the main blood vessels running between them." },
  { name: "Portal node", location: "At the centre of the rearward-facing side of the liver." },
  { name: "Gastric nodes", location: "On the rumen (stomach)." },
  { name: "Mesenteric nodes", location: "In the gut mesentery — best found by pulling the intestines out on top of the rumen with the \"cumberland sausage\" side facing down." },
];
const DEER_LYMPH_GENERAL = {
  healthy: "Firm, and a grey or pinky-brown colour, with no swelling and a uniform texture inside. Size and shape vary a little node to node — familiarity with what's normal is the best baseline.",
  unhealthy: "Enlarged, swollen or abscessed, with pus that can be liquid or solid and range from pale, cream-coloured, orange or khaki. It's recommended not to cut into nodes routinely during inspection — if one alone looks affected, note it and continue; if several look affected throughout, treat it as a suspected notifiable disease and contact your local APHA office straight away.",
};

// ---------- Diseases ----------
const DEER_DISEASES = [
  { name: "Chronic Wasting Disease (CWD)", notifiable: true, desc: "A fatal, highly infectious prion disease of the deer family. Not yet confirmed in UK deer, but a serious biosecurity concern given cases in Norway and North America — stalkers travelling abroad are asked to be meticulous about cleaning boots, clothing and equipment.", symptoms: "Gradual weight loss, listlessness, repetitive walking, loss of fear of humans, excessive drinking and salivation, tremors and poor coordination. Always fatal — there is no treatment.", url: "https://thedeerinitiative.co.uk/guides-landing-basc/disease/", source: "The Deer Initiative" },
  { name: "Bovine Tuberculosis (bTB)", notifiable: true, desc: "A chronic bacterial infection that can pass between cattle, badgers and deer. Confirmed in wild deer in parts of the UK, with a known hotspot in south-west England.", symptoms: "Often no visible signs in early stages. Advanced cases may show weight loss and poor coat condition, with pus-filled abscesses sometimes found in the lungs or lymph nodes during gralloching.", url: "https://thedeerinitiative.co.uk/wp-content/uploads/2025/02/RHMC0955-Bovine-Tuberculosis-Guide-V1.pdf", source: "The Deer Initiative" },
  { name: "Bluetongue", notifiable: true, desc: "A midge-borne virus affecting ruminants including deer. Recent strains (BTV-3) have caused restriction zones in parts of England. It doesn't affect humans or food safety, but movement rules can apply to livestock in affected zones.", symptoms: "Lethargy, swelling around the head and neck, discharge from the nose or mouth, and in severe cases a blue-tinged tongue.", url: "https://thedeerinitiative.co.uk/guides-landing-basc/disease/", source: "The Deer Initiative" },
  { name: "Foot-and-Mouth Disease (FMD)", notifiable: true, desc: "A highly contagious viral disease of cloven-hoofed animals including deer, cattle, sheep and pigs. The UK is currently officially disease-free, but past outbreaks (2001, 2007) triggered severe movement and culling restrictions.", symptoms: "Blisters on the mouth, tongue, feet and udder, lameness, drooling and reluctance to move.", url: "https://thedeerinitiative.co.uk/wp-content/uploads/2024/07/foot-mouth-disease.pdf", source: "The Deer Initiative" },
  { name: "Internal parasites (liver fluke & lungworm)", notifiable: false, desc: "Common internal parasites in UK deer. Rarely fatal on their own, but can affect body condition, and liver fluke damage is a frequent reason for a liver being condemned at the larder.", symptoms: "Poor body condition, coughing (lungworm), and scarred or damaged liver tissue found during gralloching (liver fluke).", url: "https://thedeerinitiative.co.uk/guides-landing-basc/disease/", source: "The Deer Initiative" },
  { name: "Ticks & Lyme disease", notifiable: false, desc: "Ticks are very common on deer and in the ground they use — woodland, grassland and moorland. They matter beyond the deer themselves because of what they can pass on to people and dogs handling a carcass or working the same ground.", symptoms: "Small, dark, blood-filled bodies attached to skin (on deer or people). In humans, a spreading red \"bullseye\" rash and flu-like symptoms can follow a bite and may indicate Lyme disease.", url: "https://thedeerinitiative.co.uk/wp-content/uploads/2024/07/RHMC0771_Lyme_Disease_Guide_Oct-2023-V2.pdf", source: "The Deer Initiative" },
  { name: "Deer ked (Lipoptena cervi)", notifiable: false, desc: "A small, flattened, blood-feeding fly that lives in a deer's coat and sheds its wings once it finds a host. It can also bite humans and dogs, usually dropping off a carcass or clothing after a stalk.", symptoms: "Small, fast-moving brown insects in the coat or on clothing after handling a carcass. Bites in humans can cause an itchy, sometimes long-lasting red lump.", url: "https://thedeerinitiative.co.uk/guides-landing-basc/disease/", source: "The Deer Initiative" },
];
const BOAR_DISEASES = [
  { name: "Trichinella (trichinosis)", notifiable: false, desc: "A parasitic roundworm that can infect wild boar (usually through scavenged carrion) and cause trichinosis in people who eat raw, undercooked or untested meat. Rare in the UK, but wild boar are a recognised risk species precisely because they scavenge.", symptoms: "In humans: diarrhoea, abdominal cramps and a general feeling of illness. If untreated, this can progress to fever, muscle pain and headaches, with severe cases affecting vital organs.", testing: "Any wild boar meat sold or supplied to consumers or retailers must be tested for Trichinella before it enters the food chain — and even for your own use, testing is strongly recommended and free. Free sampling kits are available from APHA. A positive result means the carcass must be traced and rejected as unfit for human consumption.", url: "https://www.food.gov.uk/business-guidance/trichinella", source: "FSA" },
  { name: "African Swine Fever (ASF)", notifiable: true, desc: "A highly infectious, usually fatal viral disease affecting all pigs, including wild boar. Not currently present in the UK, but spreading through parts of Europe — a serious biosecurity concern for anyone stalking boar abroad, or handling carcasses, clothing or equipment that's been in an affected area.", symptoms: "High fever, loss of appetite, depression and lethargy, an unsteady gait, and in severe cases blue-purple discolouration of the snout, ears, tail and lower legs.", url: "https://basc.org.uk/deer/wild-boar/african-swine-fever/", source: "BASC" },
  { name: "Classical Swine Fever (CSF)", notifiable: true, desc: "Also known as hog cholera — a contagious viral disease of domestic and wild pigs. Eradicated from Great Britain since 1966 and kept out through ongoing surveillance. Clinically almost impossible to tell apart from ASF without a lab test.", symptoms: "Fever, loss of appetite, weakness, conjunctivitis, constipation followed by diarrhoea, and an unsteady gait.", url: "https://basc.org.uk/deer/wild-boar/", source: "BASC" },
];

// ---------- Lifecycle charts ----------
const DEER_LIFECYCLE_IMAGES = {
  "Red deer": "icons_final/lifecycle/Red.png",
  "Fallow deer": "icons_final/lifecycle/Fallow.png",
  "Roe deer": "icons_final/lifecycle/Roe.png",
  "Sika deer": "icons_final/lifecycle/Sika.png",
  "Muntjac": "icons_final/lifecycle/Muntjac.png",
  "Chinese water deer": "icons_final/lifecycle/CWD.png",
};
const FOX_BOAR_LIFECYCLE = [
  ["Fox", "April – Aug (moult; new winter coat by Dec)", "Dec – Feb (peak January)", "March – April (peak mid-March)"],
  ["Wild boar", "N/A (tusks grow continuously, no shedding)", "Oct – Jan (peak Oct – Nov)", "Feb – May (farrowing)"],
];

// ---------- Game seasons ----------
const GAME_SEASONS = [
  ["Pheasant", "1 Oct – 1 Feb", "1 Oct – 1 Feb", "1 Oct – 31 Jan"],
  ["English (grey) partridge", "1 Sep – 1 Feb", "1 Sep – 1 Feb", "1 Sep – 31 Jan"],
  ["French (red-legged) partridge", "1 Sep – 1 Feb", "1 Sep – 1 Feb", "1 Sep – 31 Jan"],
  ["Mallard (duck, inland)", "1 Sep – 31 Jan", "1 Sep – 31 Jan", "1 Sep – 31 Jan"],
  ["Wigeon (duck, inland)", "1 Sep – 31 Jan", "1 Sep – 31 Jan", "1 Sep – 31 Jan"],
  ["Canada goose*", "1 Sep – 31 Jan", "1 Sep – 31 Jan", "1 Sep – 31 Jan"],
  ["Greylag goose", "1 Sep – 31 Jan", "1 Sep – 31 Jan", "1 Sep – 31 Jan"],
  ["Pinkfoot goose", "1 Sep – 31 Jan", "1 Sep – 31 Jan", "1 Sep – 31 Jan"],
  ["Egyptian goose*", "1 Sep – 31 Jan", "1 Sep – 31 Jan", "1 Sep – 31 Jan"],
  ["Common snipe", "12 Aug – 31 Jan", "12 Aug – 31 Jan", "1 Sep – 31 Jan"],
  ["Woodcock", "1 Oct – 31 Jan", "1 Sep – 31 Jan", "1 Oct – 31 Jan"],
];

// ---------- General Licences ----------
const GENERAL_LICENCES = {
  GL40: { title: "Conservation purposes", url: "https://www.gov.uk/government/publications/wild-birds-licence-to-kill-or-take-for-conservation-purposes-gl40/gl40-general-licence-to-kill-or-take-certain-species-of-wild-birds-to-conserve-endangered-wild-birds-or-flora-and-fauna", summary: "Covers killing or taking certain wild bird species — such as carrion crow, magpie and jay — where it's needed to conserve other wild birds, or flora and fauna, of conservation concern. Only an \"authorised person\" may use it, birds must be dispatched quickly and humanely, and any trapping or use of decoy birds must also follow GL33. You need Natural England's consent for any action on a SSSI." },
  GL41: { title: "Public health or public safety", url: "https://www.gov.uk/government/publications/wild-birds-licence-to-kill-or-take-for-public-health-or-safety-gl41/gl41-general-licence-to-kill-or-take-certain-species-of-wild-birds-to-preserve-public-health-or-public-safety", summary: "Covers species such as feral pigeon, jackdaw, Canada goose and monk parakeet where they pose a genuine risk to public health or safety. Birds must be dispatched quickly and humanely, and any trapping or decoy use must also follow GL33." },
  GL42: { title: "Preventing serious damage", url: "https://www.gov.uk/government/publications/wild-birds-licence-to-kill-or-take-to-prevent-serious-damage-gl42", summary: "Covers species including carrion crow, jackdaw, magpie, rook, woodpigeon, feral pigeon and various geese where they're causing (or are about to cause) serious damage to crops, livestock, growing timber or fisheries, or to help prevent disease spreading. You must have tried reasonable non-lethal methods first, and any trapping must also follow GL33." },
  GL33: { title: "Standard conditions for trapping wild birds", url: "https://www.gov.uk/government/publications/standard-licence-conditions-for-trapping-wild-birds-and-using-decoys-gl33/valid-from-1-january-trapping-wild-birds-standard-licence-conditions-wml-gl33", summary: "The baseline rules that apply whenever a cage trap or decoy bird is used under GL40, GL41 or GL42 — covering trap checks, animal welfare, and a requirement to register any decoy birds on the poultry register." },
};
const GL_SPECIES_CHART = [
  ["Canada goose", true, true, true], ["Carrion crow", true, false, true], ["Egyptian goose", true, false, true],
  ["Feral pigeon", false, true, true], ["House crow", true, false, true], ["Jackdaw", false, true, true],
  ["Jay*", true, false, false], ["Magpie", true, false, true], ["Monk parakeet", true, true, true],
  ["Ring-necked parakeet", true, false, true], ["Rook", false, false, true], ["Sacred ibis", true, false, false],
  ["Woodpigeon", false, false, true],
];

// ---------- Shared modal renderer ----------
const ReferenceInfo = {
  showModal(title, bodyHtml) {
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>${title}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div class="tracking-detail">${bodyHtml}</div>
      </div>`;
    overlay.classList.remove("hidden");
  },

  seasons() {
    const countries = Object.keys(CLOSE_SEASON);
    let html = `<p class="hint" style="margin-top:0;">Close season dates by country. "N/A" means that species isn't legally present/relevant there.</p>`;
    countries.forEach((country) => {
      const rows = Object.entries(CLOSE_SEASON[country])
        .map(([species, sexes]) => `<div class="grouped-row"><span>${species}</span><span>M: ${sexes.male}</span><span>F: ${sexes.female}</span></div>`)
        .join("");
      html += `<h4>${country}</h4>${rows}`;
    });
    this.showModal("Deer Close Seasons", html);
  },

  lymphNodes() {
    let html = `
      <p class="hint" style="margin-top:0;">The main nodes checked during carcass inspection. Not veterinary advice — if several nodes look affected together, contact your local APHA office.</p>
      <h4>What a healthy node looks like</h4><p>${DEER_LYMPH_GENERAL.healthy}</p>
      <h4>What an unhealthy node looks like</h4><p>${DEER_LYMPH_GENERAL.unhealthy}</p>`;
    DEER_LYMPH_NODES.forEach((n) => { html += `<h4>${n.name}</h4><p>${n.location}</p>`; });
    html += `<p style="margin-top:12px;"><a href="https://thedeerinitiative.co.uk/wp-content/uploads/2024/07/carcass-inspection.pdf" target="_blank" rel="noopener" style="color:var(--gold);">Full Carcass Inspection guide (The Deer Initiative)</a></p>`;
    this.showModal("Deer Lymph Nodes", html);
  },

  deerDisease() {
    let html = `<p class="hint" style="margin-top:0;">Not a complete list or veterinary advice — report anything suspicious to your local APHA office. Source: The Deer Initiative.</p>`;
    DEER_DISEASES.forEach((d) => {
      html += `<h4>${d.name}${d.notifiable ? " — Notifiable" : ""}</h4><p>${d.desc}</p><p><em>Symptoms:</em> ${d.symptoms}</p><p><a href="${d.url}" target="_blank" rel="noopener" style="color:var(--gold);">More info (${d.source})</a></p>`;
    });
    this.showModal("Deer Disease", html);
  },

  boarDisease() {
    let html = `<p class="hint" style="margin-top:0;">Not a complete list or veterinary advice — report anything suspicious (ASF/CSF) to the Defra Rural Services Helpline (03000 200 301).</p>`;
    BOAR_DISEASES.forEach((d) => {
      html += `<h4>${d.name}${d.notifiable ? " — Notifiable" : ""}</h4><p>${d.desc}</p><p><em>Symptoms:</em> ${d.symptoms}</p>${d.testing ? `<p><em>Testing:</em> ${d.testing}</p>` : ""}<p><a href="${d.url}" target="_blank" rel="noopener" style="color:var(--gold);">More info (${d.source})</a></p>`;
    });
    this.showModal("Boar Disease", html);
  },

  deerLifecycle() {
    // Chinese water deer's DEER_LIFECYCLE row is labelled "Chinese water
    // deer" but its lifecycle image is filed as CWD — same animal.
    const IMAGE_FOR = {
      "Red deer": "Red", "Fallow deer": "Fallow", "Roe deer": "Roe",
      "Sika deer": "Sika", "Muntjac": "Muntjac", "Chinese water deer": "CWD",
    };
    let html = `<p class="hint" style="margin-top:0;">General UK guidance — timings can vary a little by region and year.</p>`;
    DEER_LIFECYCLE.forEach((r) => {
      const img = IMAGE_FOR[r[0]];
      html += `<h4>${r[0]}</h4><img src="icons_final/lifecycle/${img}.png" alt="${r[0]} lifecycle chart" style="width:100%; max-width:500px; display:block; margin:0 auto 20px;" />`;
    });
    this.showModal("Deer Lifecycle Chart", html);
  },

  foxBoarLifecycle(species) {
    const data = species ? FOX_BOAR_LIFECYCLE.filter((r) => r[0] === species) : FOX_BOAR_LIFECYCLE;
    let html = `<p class="hint" style="margin-top:0;">General UK guidance — timings can vary by region, year and food availability.</p>`;
    data.forEach((r) => { html += `<h4>${r[0]}</h4><p>Coat/tusks: ${r[1]}<br>Rut: ${r[2]}<br>Birthing/farrowing: ${r[3]}</p>`; });
    this.showModal(species ? `${species} Lifecycle` : "Fox & Boar Lifecycle", html);
  },

  gameSeasons() {
    let html = `<p class="hint" style="margin-top:0;">Duck and goose dates are for inland waters — the season runs 3 weeks longer (to 20 February) below the high-water mark of ordinary spring tides. Source: BASC.</p>`;
    GAME_SEASONS.forEach((r) => { html += `<h4>${r[0]}</h4><p>England &amp; Wales: ${r[1]}<br>Scotland: ${r[2]}<br>Northern Ireland: ${r[3]}</p>`; });
    html += `<p class="hint">*Canada goose and Egyptian goose can also be controlled outside this season under general licence.</p>`;
    this.showModal("Game Seasons", html);
  },

  generalLicences() {
    let html = `<p class="hint" style="margin-top:0;">Summaries only — always check the official GOV.UK page for current, full conditions.</p>`;
    Object.entries(GENERAL_LICENCES).forEach(([code, gl]) => {
      html += `<h4>${code}: ${gl.title}</h4><p>${gl.summary}</p><p><a href="${gl.url}" target="_blank" rel="noopener" style="color:var(--gold);">Full conditions (GOV.UK)</a></p>`;
    });
    html += `<h4>Species chart</h4>`;
    GL_SPECIES_CHART.forEach((row) => {
      html += `<div class="grouped-row"><span>${row[0]}</span><span>GL40: ${row[1] ? "✓" : "—"}</span><span>GL41: ${row[2] ? "✓" : "—"}</span><span>GL42: ${row[3] ? "✓" : "—"}</span></div>`;
    });
    this.showModal("General Licences", html);
  },
};
