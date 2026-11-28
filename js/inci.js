// Разбор состава (INCI): находит активы по списку ингредиентов
// Каждое правило: актив, список шаблонов (подстрока в нижнем регистре), необязательная проверка позиции
const RULES = [
  ['aha', ['glycolic acid', 'lactic acid', 'mandelic acid', 'malic acid', 'tartaric acid', 'phytic acid']],
  ['bha', ['salicylic acid', 'betaine salicylate', 'salix alba', 'willow bark', 'capryloyl salicylic', 'sodium salicylate']],
  ['pha', ['gluconolactone', 'lactobionic acid', 'galactose']],
  ['azelaic', ['azelaic acid', 'azeloyl']],
  ['retinoid', ['retinol', 'retinal', 'retinyl', 'retinoate', 'adapalene', 'tretinoin']],
  ['spicule', ['spicule', 'spongilla', 'hydrolyzed sponge', 'sponge']],
  ['vitc', ['ascorbic acid', 'ascorbyl', 'ascorbate']],
  ['niacinamide', ['niacinamide', 'nicotinamide']],
  ['peptides', ['peptide', 'palmitoyl', 'acetyl hexapeptide', 'tripeptide', 'tetrapeptide', 'volufiline', 'argireline', 'matrixyl']],
  ['ceramides', ['ceramide']],
  ['hyaluronic', ['hyaluronic', 'hyaluronate']],
  ['centella', ['centella asiatica', 'madecassoside', 'asiaticoside', 'madecassic', 'asiatic acid', 'cica']],
  ['zinc', ['zinc pca', 'zinc gluconate', 'zinc sulfate', 'zinc oxide', 'zinc']],
  ['hocl', ['hypochlorous']],
  ['collagen', ['collagen']],
  ['rice', ['oryza sativa', 'rice']],
  ['panthenol', ['panthenol', 'pantothenic']],
  ['spf', ['zinc oxide', 'titanium dioxide', 'avobenzone', 'octocrylene', 'homosalate', 'octisalate', 'ethylhexyl salicylate',
    'bis-ethylhexyloxyphenol', 'ethylhexyl triazone', 'diethylamino hydroxybenzoyl', 'ethylhexyl methoxycinnamate', 'octinoxate',
    'methylene bis-benzotriazolyl', 'drometrizole', 'tinosorb', 'uvinul', 'butyl methoxydibenzoylmethane', 'polysilicone-15', 'phenylbenzimidazole']],
  ['bpo', ['benzoyl peroxide']],
  ['silica', ['silica', 'perlite', 'kaolin', 'bentonite', 'nylon-12', 'polymethylsilsesquioxane']],
  // 2.14
  ['enzyme', ['protease', 'papain', 'bromelain', 'subtilisin', 'lipase', 'amylase', 'carica papaya fruit extract', 'ananas sativus fruit extract']],
  ['urea', ['urea']],
  ['betaine', ['betaine']],
  ['pga', ['polyglutamic', 'polyglutamate']],
  ['betaglucan', ['beta-glucan', 'glucan']],
  ['minerals', ['sea water', 'maris aqua', 'magnesium chloride', 'deep sea water', 'mineral water', 'thermal water', 'avene thermal']],
  ['ferment', ['ferment', 'lactobacillus', 'bifida', 'galactomyces', 'saccharomyces', 'lactococcus', 'bacillus']],
  ['allantoin', ['allantoin']],
  ['ectoin', ['ectoin']],
  ['mugwort', ['artemisia']],
  ['heartleaf', ['houttuynia']],
  ['propolis', ['propolis']],
  ['teatree', ['melaleuca alternifolia', 'tea tree']],
  ['sulfur', ['sulfur']],
  ['squalane', ['squalane', 'squalene']],
  ['lipids', ['cholesterol', 'phytosphingosine', 'sphingolipid', 'linoleic acid', 'palmitic acid', 'stearic acid', 'oleic acid']],
  ['adenosine', ['adenosine']],
  ['pdrn', ['pdrn', 'sodium dna', 'polydeoxyribonucleotide', 'deoxyribonucleic']],
  ['snail', ['snail secretion', 'mucin']],
  ['copper', ['copper tripeptide', 'copper peptide', 'copper gluconate']],
  ['bakuchiol', ['bakuchiol']],
  ['tranexamic', ['tranexamic']],
  ['arbutin', ['arbutin']],
  ['kojic', ['kojic']],
  ['licorice', ['glycyrrhiza', 'glycyrrhizate', 'glabridin', 'licorice']],
  ['glutathione', ['glutathione']],
  ['vite', ['tocopherol', 'tocopheryl']],
  ['resveratrol', ['resveratrol']],
  ['greentea', ['camellia sinensis', 'green tea']],
  ['ferulic', ['ferulic']],
  ['coq10', ['ubiquinone', 'coenzyme q10']],
  ['essential', ['lavandula angustifolia oil', 'lavender oil', 'citrus aurantium dulcis peel oil', 'citrus limon peel oil', 'mentha piperita oil',
    'eucalyptus globulus leaf oil', 'rosmarinus officinalis leaf oil', 'pelargonium graveolens', 'cananga odorata', 'rosa damascena flower oil',
    'citrus aurantium bergamia', 'cymbopogon', 'origanum', 'cinnamomum', 'eugenia caryophyllus', 'juniperus', 'citrus paradisi peel oil', 'peppermint oil']],
];

// Ингредиенты, которые по шкалам комедогенности могут забивать поры (важно при закрытых комедонах)
const COMEDO = ['isopropyl myristate', 'isopropyl palmitate', 'isopropyl isostearate', 'isostearyl isostearate', 'myristyl myristate',
  'myristyl lactate', 'cetyl acetate', 'acetylated lanolin', 'laureth-4', 'oleth-3', 'cocos nucifera oil', 'coconut oil', 'cocoa butter',
  'theobroma cacao seed butter', 'triticum vulgare germ oil', 'wheat germ oil', 'sodium lauryl sulfate', 'ethylhexyl palmitate',
  'octyl palmitate', 'isocetyl stearate', 'decyl oleate', 'octyl stearate', 'butyl stearate', 'glyceryl-3 diisostearate',
  'peg-16 lanolin', 'isodecyl oleate', 'lauric acid', 'myristic acid', 'algae extract', 'carrageenan', 'linum usitatissimum seed oil',
  'cetearyl isononanoate', 'isostearyl neopentanoate', 'laminaria', 'corn oil', 'zea mays germ oil', 'soybean oil', 'glycine soja oil',
  'shea butter', 'butyrospermum parkii'];

// Роли ингредиентов: [роль, шаблоны]. Первое совпадение выигрывает
export const ROLES = {
  base:     { name: 'основа',          color: '#E8E2D8' },
  humect:   { name: 'увлажнитель',     color: '#D7E3F3' },
  emol:     { name: 'смягчает / масло', color: '#F4E3C9' },
  silicone: { name: 'силикон',         color: '#E3E6EC' },
  thick:    { name: 'текстура',        color: '#ECE7F2' },
  emuls:    { name: 'эмульгатор',      color: '#EFE3EA' },
  surf:     { name: 'очищает (ПАВ)',   color: '#DDEFE6' },
  preserv:  { name: 'консервант',      color: '#F1E6D6' },
  chel:     { name: 'стабилизатор',    color: '#EDEAE4' },
  ph:       { name: 'регулятор pH',    color: '#EDEAE4' },
  plant:    { name: 'экстракт',        color: '#E4EFD9' },
  antiox:   { name: 'антиоксидант',    color: '#F6E7C8' },
  filter:   { name: 'УФ-фильтр',       color: '#FBF1D8' },
  color:    { name: 'пигмент',         color: '#F3D3DA' },
  frag:     { name: 'отдушка',         color: '#F7D9D2' },
  solvent:  { name: 'растворитель',    color: '#EDEAE4' },
  film:     { name: 'плёнка / фиксация', color: '#ECE7F2' },
  active:   { name: 'актив',           color: '#F3D3DA' },
};
const ROLE_RULES = [
  ['base', /^(water|aqua|eau|purified water|aqua\/water|water\/aqua)$/],
  ['frag', /parfum|fragrance|aroma|linalool|limonene|citronellol|geraniol|eugenol|citral|coumarin|benzyl salicylate|hexyl cinnamal|farnesol|benzyl benzoate|amyl cinnamal|cinnamyl alcohol|isoeugenol|anise alcohol|benzyl cinnamate|alpha-isomethyl ionone/],
  ['color', /^ci \d{5}|iron oxides|mica|titanium dioxide.*ci|ultramarines|chromium oxide|carmine|bismuth oxychloride|tin oxide/],
  ['filter', /zinc oxide|titanium dioxide|avobenzone|octocrylene|homosalate|octisalate|ethylhexyl salicylate|bis-ethylhexyloxyphenol|ethylhexyl triazone|diethylamino hydroxybenzoyl|methoxycinnamate|octinoxate|methylene bis-benzotriazolyl|drometrizole|tinosorb|uvinul|butyl methoxydibenzoylmethane|polysilicone-15|phenylbenzimidazole|benzophenone|isoamyl p-methoxycinnamate|diethylhexyl butamido triazone|tris-biphenyl triazine/],
  ['preserv', /phenoxyethanol|paraben|ethylhexylglycerin|1,2-hexanediol|caprylyl glycol|sodium benzoate|potassium sorbate|sorbic acid|benzoic acid|chlorphenesin|benzyl alcohol|dehydroacetic|methylisothiazolinone|methylchloroisothiazolinone|hydroxyacetophenone|pentylene glycol|glyceryl caprylate|caprylhydroxamic|polyaminopropyl biguanide|o-cymen-5-ol|dmdm hydantoin|imidazolidinyl urea|diazolidinyl urea|sodium dehydroacetate|levulinic|p-anisic|ethylhexyl glycerin|1,2-octanediol|octanediol/],
  ['chel', /edta|phytate|phytic|etidronate|tetrasodium glutamate diacetate|sodium gluconate|trisodium ethylenediamine|glucono/],
  ['ph', /citric acid|sodium citrate|sodium hydroxide|potassium hydroxide|tromethamine|triethanolamine|aminomethyl propanol|arginine|sodium phosphate|disodium phosphate|lactic acid.*ph|sodium lactate|malic acid$|succinic acid/],
  ['surf', /sulfate|sulfonate|cocamidopropyl|betaine$|sultaine|glucoside$|coco-glucoside|decyl glucoside|lauryl glucoside|cocoyl|lauroyl|myristoyl glutamate|sodium methyl cocoyl taurate|isethionate|sarcosinate|amphoacetate|glutamate$|potassium cocoate|sodium cocoate|soap|laurate$|myristate$.*potassium|potassium myristate|potassium laurate|potassium stearate|potassium palmitate/],
  ['silicone', /dimethicone|methicone|siloxane|cyclopenta|cyclohexa|silsesquioxane|dimethiconol|trimethylsiloxysilicate|disiloxane|trisiloxane|crosspolymer.*dimethicone|silicone/],
  ['emuls', /polysorbate|peg-\d+|ppg-\d+|glyceryl stearate|sorbitan|lecithin|olivate|ceteareth|steareth|laureth|oleth|polyglyceryl|cetearyl glucoside|arachidyl glucoside|sucrose stearate|sucrose laurate|glyceryl oleate|potassium cetyl phosphate|sodium stearoyl glutamate|hydrogenated lecithin|methyl glucose sesquistearate|c12-20 alkyl glucoside|c14-22 alcohols|behenyl alcohol.*glucoside|inulin lauryl carbamate|lauryl peg/],
  ['thick', /xanthan|carbomer|acrylate|acrylic|cellulose|gum\b|gum$|polyacrylate|taurate copolymer|agar|alginate|carrageenan|pectin|gellan|sclerotium|starch|bentonite|silica|magnesium aluminum silicate|hectorite|polyacrylamide|cellulose gum|hydroxyethyl|hydroxypropyl|ammonium acryloyldimethyltaurate|dextrin|maltodextrin|pullulan|nylon|polymethyl methacrylate|boron nitride|kaolin|talc|cetyl alcohol|cetearyl alcohol|stearyl alcohol|behenyl alcohol|arachidyl alcohol|myristyl alcohol|microcrystalline/],
  ['film', /pvp|vp\/|polyquaternium|acrylates copolymer|polyvinyl|shellac|trimethylsiloxysilicate|copernicia cerifera|cera alba|beeswax|candelilla|microcrystalline wax|ozokerite|paraffin|polyethylene/],
  ['solvent', /^alcohol( denat\.?)?$|^ethanol$|isopropyl alcohol|dipropylene glycol|propylene glycol$|isododecane|isohexadecane|hexylene glycol|ethoxydiglycol/],
  ['humect', /glycerin|glycerol|butylene glycol|propanediol|methylpropanediol|propylene glycol|pentylene glycol|sorbitol|xylitol|erythritol|glucose|trehalose|sucrose$|honey|mel\b|fructose|sodium pca|pca$|hyaluron|betaine|urea|sodium lactate|lactic acid|panthenol|polyglutam|tremella|saccharide isomerate|aloe|inositol|glycereth|diglycerin|polyglycerin|1,3-propanediol|amino acid|serine|glycine$|alanine|proline|arginine|threonine|lysine|histidine|algin/],
  ['emol', /oil|butter|squalane|squalene|triglyceride|caprylic\/capric|isopropyl|ethylhexyl palmitate|cetyl ethylhexanoate|isononanoate|neopentanoate|dicaprylyl|carbonate|polydecene|hydrogenated polyisobutene|isohexadecane|mineral oil|petrolatum|lanolin|shea|stearate$|palmitate$|myristate$|laurate$|oleate$|cocoate|esters|jojoba|ceramide|cholesterol|fatty acid|stearic acid|palmitic acid|linoleic|oleic|coco-caprylate|caprylate|undecane|tridecane|c13-15 alkane|c15-19 alkane|hemisqualane|dimer dilinoleate|wax|cera\b|phytosterol|lecithin/],
  ['antiox', /tocopher|ascorbyl|bht|bha$|rosemary|ferulic|resveratrol|ubiquinone|retinyl palmitate|carotene|astaxanthin|glutathione|propyl gallate|sodium metabisulfite|rosmarinic|green tea|camellia sinensis/],
  ['plant', /extract|leaf water|flower water|fruit water|root water|hydrosol|juice|ferment|powder$|callus|seed water|bark water|leaf powder|stem cell|filtrate|lysate|centella|madecass|asiatic|artemisia|houttuynia|propolis|snail/],
];

export function roleOf(ingLow) {
  for (const [r, re] of ROLE_RULES) if (re.test(ingLow)) return r;
  return null;
}

// спирты, которые сушат (жирные спирты вроде cetearyl alcohol — нет)
const DRY_ALCOHOL = /^(alcohol( denat\.?)?|ethanol|sd alcohol( \d+-?\w*)?|alcohol denat\.?|isopropyl alcohol)$/;
const FRAGRANCE = ['parfum', 'fragrance', 'aroma', 'linalool', 'limonene', 'citronellol', 'geraniol', 'eugenol', 'citral', 'coumarin', 'benzyl salicylate', 'hexyl cinnamal', 'farnesol'];
const FRAG_EXACT = ['parfum', 'fragrance', 'aroma', 'parfum/fragrance', 'fragrance/parfum'];

export function splitInci(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/^.*?(ingredients|состав|inci)\s*[:：]/i, '')
    .replace(/\([^)]*\)/g, m => m.replace(/,/g, ' '))
    .replace(/(\d),(\d)/g, '$1\u201A$2') // 1,2-Hexanediol — не делить
    .split(/[,;\n•·|]+/)
    .map(s => s.replace(/\u201A/g, ',').trim().replace(/\.$/, '').replace(/\s+/g, ' '))
    .filter(s => s && s.length < 90);
}

// возвращает { found: [{active, ing, pos}], count }
export function parseInci(text) {
  const list = splitInci(text);
  const low = list.map(s => s.toLowerCase());
  const found = new Map();
  const add = (active, ing, pos) => { if (!found.has(active)) found.set(active, { active, ing, pos }); };

  low.forEach((ing, i) => {
    for (const [active, pats] of RULES) {
      if (active === 'zinc' && /zinc stearate/.test(ing)) continue;
      if (active === 'rice' && !/oryza sativa|rice/.test(ing)) continue;
      if (active === 'spicule' && !/spicule|spongilla|sponge/.test(ing)) continue;
      if (pats.some(p => ing.includes(p))) add(active, list[i], i + 1);
    }
    // спирт высоко в составе — первые 6 позиций
    if (i < 6 && DRY_ALCOHOL.test(ing)) add('alcohol', list[i], i + 1);
    const parts = ing.split(/\s*\/\s*/);
    if (FRAG_EXACT.includes(ing) || parts.some(x => FRAGRANCE.includes(x))) add('fragrance', list[i], i + 1);
    // масла в первой десятке
    if (i < 10 && /\boil\b|butter/.test(ing) && !/oil-free|hydrogenated castor|peg-\d+/.test(ing)) add('oil', list[i], i + 1);
  });
  // цинк от фильтра ZnO — это SPF, а не уход
  if (found.has('zinc') && /zinc oxide/i.test(found.get('zinc').ing) && found.has('spf')) found.delete('zinc');
  // жирные кислоты в составе мыла/ПАВ — не «липиды барьера»
  if (found.has('lipids') && !low.some(x => /cholesterol|ceramide|phytosphingosine/.test(x))) found.delete('lipids');
  // каждый ингредиент: роль, актив, комедогенность
  const actOf = new Map();
  low.forEach((ing, i) => { for (const [active, pats] of RULES) if (pats.some(p => ing.includes(p)) && found.get(active)?.pos === i + 1) actOf.set(i, active); });
  const pores = [];
  const items = list.map((name, i) => {
    const l = low[i];
    const comedo = COMEDO.some(c => l.includes(c));
    if (comedo) pores.push({ name, pos: i + 1 });
    let role = roleOf(l);
    const act = actOf.get(i) || null;
    if (act && !['spf', 'alcohol', 'fragrance', 'oil', 'silica', 'essential'].includes(act)) role = 'active';
    return { pos: i + 1, name, role, act, comedo };
  });
  if (pores.length) add('comedo', pores[0].name, pores[0].pos);
  const known = items.filter(x => x.role).length;
  // примерная граница «около 1%»: первый консервант после 4-й позиции
  const onePct = items.findIndex((x, i) => i >= 4 && x.role === 'preserv');
  return { found: [...found.values()].sort((a, b) => a.pos - b.pos), count: list.length, items, known, pores, onePct: onePct >= 0 ? onePct + 1 : null };
}
