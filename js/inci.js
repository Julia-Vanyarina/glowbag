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
];

// спирты, которые сушат (жирные спирты вроде cetearyl alcohol — нет)
const DRY_ALCOHOL = /^(alcohol( denat\.?)?|ethanol|sd alcohol( \d+-?\w*)?|alcohol denat\.?|isopropyl alcohol)$/;
const FRAGRANCE = ['parfum', 'fragrance', 'aroma', 'linalool', 'limonene', 'citronellol', 'geraniol', 'eugenol', 'citral', 'coumarin', 'benzyl salicylate', 'hexyl cinnamal', 'farnesol'];
const FRAG_EXACT = ['parfum', 'fragrance', 'aroma', 'parfum/fragrance', 'fragrance/parfum'];

export function splitInci(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/^.*?(ingredients|состав|inci)\s*[:：]/i, '')
    .replace(/\([^)]*\)/g, m => m.replace(/,/g, ' '))
    .split(/[,;\n•·|]+/)
    .map(s => s.trim().replace(/\.$/, '').replace(/\s+/g, ' '))
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
  return { found: [...found.values()].sort((a, b) => a.pos - b.pos), count: list.length };
}
