// Справочники и стартовые данные glowbag
export const APP_VERSION = '2.15.0';
export const APP_BUILD = '28.11.2026';

export const CHANGELOG = [
  { v: '2.15.0', d: '28.11.2026', items: [
    'Проба Air Shot до 3 декабря — в ближайший домашний день с вечером без Азелика (1 декабря или раньше)',
    'После пробы субботы до 17 декабря: Air Shot + MC, без Booster',
  ]},
  { v: '2.14.2', d: '28.11.2026', items: [
    'До 17 декабря Mask — по воскресеньям, как в рутине AGE-R',
  ]},
  { v: '2.14.1', d: '28.11.2026', items: [
    'Инструкция аппарата по официальной странице Medicube: Air Shot — по сухой коже и первым, порядок режимов, уровень 1 на тонких зонах',
  ]},
  { v: '2.14.0', d: '28.11.2026', items: [
    'Словарь состава вырос: 55 активов вместо 23 — ферменты, мочевина, сквалан, транексамовая, PDRN, бакучиол и др.',
    'Разбор каждого ингредиента по ролям: основа, увлажнитель, эмолент, консервант, ПАВ, загуститель… — около 600 названий',
    'Отметка «может забивать поры» — важно при закрытых комедонах',
    'Полный разбор состава виден и в карточке средства',
  ]},
  { v: '2.13.0', d: '28.11.2026', items: [
    'Аппарат AGE-R нарисован и лежит в косметичке — вылетает вместе с остальными средствами',
    'Новый тип средства «Аппарат» — можно добавить и другие',
  ]},
  { v: '2.12.0', d: '28.11.2026', items: [
    'План: касание по дате — дома ↔ офис для конкретного дня',
    'Если день стал офисным, процедура аппарата сама переезжает на ближайший домашний день',
    'Вернула день домой — процедура возвращается обратно',
  ]},
  { v: '2.11.0', d: '28.11.2026', items: [
    'Уход → «план»: две недели по дням, аппарат и вечера плашками',
    'Перетащи плашку на другой день — процедуры поменяются местами, схема пересчитается',
    'Одно касание по вечеру — Азелик ↔ отдых, в том числе за прошлые дни',
    'Касание по аппарату — выбрать день для переноса или убрать',
  ]},
  { v: '2.10.1', d: '28.11.2026', items: [
    'План аппарата совпадает с рутиной в приложении AGE-R: вт Booster + MC, чт Booster, сб Booster + MC + Mask',
  ]},
  { v: '2.10.0', d: '28.11.2026', items: [
    'Новый раздел «Аппарат» для Medicube AGE-R Booster Pro: шаги процедуры и режимы на каждый день',
    'План по дням: утром вт/чт/сб/вс, знакомство до 16 декабря, потом основная схема',
    'Карточка «Аппарат сегодня» на главной и инструкция: режимы, средства, зоны, когда остановиться',
    'Желейный мист Dr.Althea добавлен в косметичку — основа под аппарат',
  ]},
  { v: '2.9.0', d: '25.11.2026', items: [
    'УФ-индекс на главной: сегодня, сейчас и на неделю вперёд',
    'Шаг SPF «по погоде»: при УФ ниже 3 его можно пропустить — прогресс не страдает',
    'Учитывается SPF в макияже — у BB Dr.Jart+ стоит SPF 50',
    'Заказанное средство: кнопка «Пришло» в карточке и прямо в схеме ухода',
    'Поле SPF в карточке для солнцезащиты и декоративки',
  ]},
  { v: '2.8.2', d: '24.11.2026', items: [
    'Стол становится больше, когда на нём много средств',
    'Кнопка «разложить» — ровно раскладывает всё на столе',
    'Фото средств — аккуратные наклейки-полароиды размером с рисунок',
  ]},
  { v: '2.8.1', d: '24.11.2026', items: [
    'Обновления находятся надёжнее: приложение сверяет версию с сайтом напрямую',
    'Если файл sw.js забыли поменять — обновление всё равно подтянется',
  ]},
  { v: '2.8.0', d: '22.11.2026', items: [
    'Один «Вечер» с бегунком «с Азеликом / отдых» — ставится по плану, можно поменять',
    'План чередования идёт от того, что было на самом деле',
    'День ухода заканчивается в 5 утра — ночные отметки идут во вчерашний вечер',
    'В календаре можно указать, какой был вечер в прошлые дни',
  ]},
  { v: '2.7.0', d: '22.11.2026', items: [
    'Новая шрифтовая пара: курсив Lora и гротеск Montserrat',
    'Шрифты встроены в приложение — работают без интернета',
  ]},
  { v: '2.6.0', d: '22.11.2026', items: [
    'Шрифтовая пара: каллиграфия Great Vibes и гротеск Inter Tight',
    'Фон цвета бумаги и слоновой кости, цвет — только акцентами',
    'Меню выпадает из кнопки в шапке вместо панели внизу',
  ]},
  { v: '2.5.0', d: '22.11.2026', items: [
    'Палитра как в карусели: пыльно-розовый, крем, пудрово-голубой, малина и хром',
    'Узоры: голубая клетка, полоски, горошек, лён',
    'Хромированные звёзды, кружевная салфетка, планшет с зажимом, блокнот на пружине, тарелка',
    'Заголовки-ярлыки на бумажных полосках (3D и плоские — в Профиле)',
    'Косметичка в голубую клетку с серебряной молнией',
  ]},
  { v: '2.4.0', d: '22.11.2026', items: [
    'Пудровая палитра: пыльная роза, сирень, фисташка и небесно-голубой',
    'Мягкие 3D-заголовки без кислотных цветов',
  ]},
  { v: '2.3.0', d: '22.11.2026', items: [
    'Палитра в стиле Psicomess: фиолетовый, жвачно-розовый, лайм и лаванда',
    'Новые 3D-заголовки: глянцевые надутые буквы с объёмным бортиком и белой обводкой',
    'Косметичка в розово-фиолетовую клетку',
  ]},
  { v: '2.2.0', d: '22.11.2026', items: [
    'Новая палитра: голубой и масляный, кофейный и розовый, карамель и крем-брюле, матча и молочный',
    'Объёмные заголовки: пушистые буквы или 3D-стикеры (Профиль → Оформление)',
  ]},
  { v: '2.1.0', d: '21.11.2026', items: [
    'Календарь ухода: тепловая карта, вечера с Азеликом, серия дней без пропусков',
    'Напоминания в календарь iPhone: Азелик, конец паузы, сроки годности, бэкап, смена сезона',
    'Разбор состава INCI — активы отмечаются сами',
    'Зимняя и летняя схемы ухода с переключением',
    'Покупки: вишлист со ссылками, пустые баночки «куплю снова / не куплю», траты по месяцам',
  ]},
  { v: '2.0.0', d: '21.11.2026', items: [
    'Новый дизайн glowbag: рваная бумага, стикеры, коллаж',
    'Косметичка с перетаскиванием: доставай средства на стол, кидай в уход, в любимое или на полку',
    'Каталог с фильтрами и кнопкой «в косметичку»',
    'Экран «Любимое»',
    'Анализ, бэкап и версии переехали в профиль',
  ]},
  { v: '1.0.0', d: '20.11.2026', items: [
    'Косметичка, схема ухода, анализ средств, бэкап',
  ]},
];

// цвета палитры glowbag и их оттенки
export const C = {
  cream: '#FBF6EF', cream2: '#EFE5D8', pink: '#F3D3DA', pink2: '#E4AFBB',
  blue: '#D7E3F3', blue2: '#9DB7DD', orange: '#B8324A', orange2: '#F4ECDD', wine: '#2B2627', white: '#FFFFFF',
  caramel2: '#EFC6CE', matcha: '#BFC4CC', matcha2: '#E3E6EB', milk: '#FFFFFF', butter: '#F4ECDD', hot: '#D2566C',
  lav: '#E4EBF6', lav2: '#B6C7E4', bg: '#F7F1E7', ivory: '#FFFDF8',
};
// палитра 2.4 (пудровая) → 2.5 (карусель: розовый, голубой, крем, малина, хром)
export const PALETTE_24 = {
  '#FBF6F9': '#FFFFFF', '#F1E6EE': '#EFE5D8', '#F6DCE8': '#F3D3DA', '#E9B6CC': '#E4AFBB', '#D6E7F5': '#D7E3F3',
  '#A9CBE8': '#9DB7DD', '#7E6AB5': '#B8324A', '#EEF3D6': '#F4ECDD', '#3A2F4A': '#2B2627', '#F2CADD': '#EFC6CE',
  '#C5D59A': '#BFC4CC', '#E4ECCB': '#E3E6EB', '#FDFBFD': '#FFFFFF', '#DE9BBE': '#D2566C', '#E4DAF3': '#E4EBF6', '#B9A6DD': '#B6C7E4',
};
// палитра 2.3 (яркая) → 2.4 (пудровая)
export const PALETTE_23 = {
  '#FFF3F8': '#FBF6F9', '#F7DDEC': '#F1E6EE', '#FFD1EC': '#F6DCE8', '#FF8FCB': '#E9B6CC', '#DCCBFB': '#E4DAF3',
  '#9B6FE8': '#B9A6DD', '#7444D4': '#7E6AB5', '#EEF8B5': '#EEF3D6', '#2B1840': '#3A2F4A', '#FFB3DC': '#F2CADD',
  '#C6E35A': '#C5D59A', '#E4F3A2': '#E4ECCB', '#FBF7FF': '#FDFBFD', '#F25FB0': '#DE9BBE',
};
// палитра 2.2 (кофе/карамель) → палитра 2.3
export const PALETTE_22 = {
  '#FFF2E0': '#FBF7FF', '#F0DEC6': '#F7DDEC', '#F7D8E0': '#FFD1EC', '#EDB8C6': '#FF8FCB', '#CBD8F1': '#DCCBFB',
  '#92ACDD': '#9B6FE8', '#A57149': '#7444D4', '#FFF8C7': '#EEF8B5', '#422B26': '#2B1840', '#D9B48F': '#FFB3DC',
  '#A5AF5D': '#C6E35A', '#D6DBA9': '#E4F3A2', '#F7F7E7': '#FBF7FF',
};
// цвета прошлых версий → новая палитра (для старых данных)
export const OLD_COLORS = {
  '#FCF4F0': '#F7F7E7', '#EED9CB': '#F0DEC6', '#FFD5FB': '#F7D8E0', '#F7AEEB': '#EDB8C6', '#C0D6FF': '#CBD8F1',
  '#93B4F6': '#92ACDD', '#F86C2F': '#A57149', '#FBB08C': '#D9B48F', '#6D0101': '#422B26',
};

export const CATEGORIES = [
  { id: 'face',    name: 'Уход',        color: C.pink },
  { id: 'makeup',  name: 'Декоративка', color: C.orange2 },
  { id: 'perfume', name: 'Парфюм',      color: C.matcha2 },
  { id: 'body',    name: 'Тело',        color: C.caramel2 },
  { id: 'hair',    name: 'Волосы',      color: C.lav },
];

export const TYPES = {
  face: [
    ['cleanser', 'Умывалка', 'pump'], ['toner', 'Тонер / тоник', 'bottle'], ['mist', 'Мист', 'spray'],
    ['serum', 'Сыворотка', 'dropper'], ['treatment', 'Лечебное средство', 'tube'], ['cream', 'Крем', 'jar'],
    ['eye', 'Крем для глаз', 'tube'], ['spf', 'SPF', 'tube'], ['mask', 'Маска', 'jar'],
    ['exfoliant', 'Пилинг / спикулы', 'dropper'], ['stick', 'Стик / бальзам', 'stick'], ['lip', 'Уход для губ', 'stick'], ['device', 'Аппарат', 'device'],
  ],
  makeup: [
    ['foundation', 'Тональный', 'pump'], ['concealer', 'Консилер', 'wand'], ['powder', 'Пудра', 'compact'],
    ['blush', 'Румяна', 'compact'], ['primer', 'Праймер', 'tube'], ['brows', 'Брови', 'wand'],
    ['mascara', 'Тушь', 'wand'], ['eyeshadow', 'Тени', 'palette'], ['lipstick', 'Помада', 'lipstick'],
    ['gloss', 'Блеск', 'wand'], ['setting', 'Фиксатор', 'spray'],
  ],
  perfume: [['edp', 'Парфюмерная вода', 'perfume'], ['edt', 'Туалетная вода', 'perfume'], ['bodymist', 'Мист для тела', 'spray']],
  body: [
    ['shower', 'Гель для душа', 'pump'], ['scrub', 'Скраб', 'jar'], ['lotion', 'Лосьон / крем', 'tube'],
    ['oil', 'Масло', 'dropper'], ['deo', 'Дезодорант', 'stick'], ['hand', 'Крем для рук', 'tube'], ['bodyspf', 'SPF для тела', 'tube'],
  ],
  hair: [
    ['shampoo', 'Шампунь', 'pump'], ['conditioner', 'Бальзам', 'tube'], ['hairmask', 'Маска', 'jar'],
    ['leavein', 'Несмываемое', 'spray'], ['hairoil', 'Масло', 'dropper'], ['styling', 'Стайлинг', 'spray'], ['dryshampoo', 'Сухой шампунь', 'spray'],
  ],
};

export const STATUSES = [
  { id: 'use',   name: 'Использую',     color: C.pink },
  { id: 'low',   name: 'Заканчивается', color: C.orange2 },
  { id: 'pause', name: 'На паузе',      color: C.cream2 },
  { id: 'order', name: 'Заказано',      color: C.blue },
  { id: 'wish',  name: 'Хочу',          color: C.pink2 },
  { id: 'empty', name: 'Закончилось',   color: C.cream },
];

export const ACTIVES = [
  ['aha', 'AHA-кислоты', 'exf'], ['bha', 'BHA / салициловая', 'exf'], ['pha', 'PHA', 'exf'],
  ['azelaic', 'Азелаиновая', 'exf'], ['retinoid', 'Ретиноиды', 'ret'], ['spicule', 'Спикулы', 'exf'],
  ['vitc', 'Витамин C', 'vitc'], ['niacinamide', 'Ниацинамид', 'calm'], ['peptides', 'Пептиды', 'repair'],
  ['ceramides', 'Керамиды', 'repair'], ['hyaluronic', 'Гиалуроновая', 'hydra'], ['centella', 'Центелла', 'calm'],
  ['zinc', 'Цинк', 'calm'], ['hocl', 'Гипохлорная', 'calm'], ['collagen', 'Коллаген', 'hydra'],
  ['rice', 'Рис', 'hydra'], ['panthenol', 'Пантенол', 'calm'], ['spf', 'SPF-фильтры', 'spf'],
  ['alcohol', 'Спирт высоко', 'dry'], ['fragrance', 'Отдушка', 'frag'], ['oil', 'Масла', 'oil'],
  ['silica', 'Матирующие', 'mat'], ['bpo', 'Бензоилпероксид', 'bpo'],
  // 2.14 — расширенный словарь
  ['enzyme', 'Ферменты', 'exf'], ['urea', 'Мочевина', 'hydra'], ['betaine', 'Бетаин', 'hydra'],
  ['pga', 'Полиглутаминовая', 'hydra'], ['betaglucan', 'Бета-глюкан', 'calm'], ['minerals', 'Морская вода / минералы', 'hydra'],
  ['ferment', 'Ферментаты / пробиотики', 'hydra'], ['allantoin', 'Аллантоин', 'calm'], ['ectoin', 'Эктоин', 'calm'],
  ['mugwort', 'Полынь', 'calm'], ['heartleaf', 'Хауттюйния', 'calm'], ['propolis', 'Прополис', 'calm'],
  ['teatree', 'Чайное дерево', 'acne'], ['sulfur', 'Сера', 'acne'], ['squalane', 'Сквалан', 'repair'],
  ['lipids', 'Холестерин / жирные кислоты', 'repair'], ['adenosine', 'Аденозин', 'repair'], ['pdrn', 'PDRN / ДНК', 'repair'],
  ['snail', 'Муцин улитки', 'repair'], ['copper', 'Медные пептиды', 'repair'], ['bakuchiol', 'Бакучиол', 'ret'],
  ['tranexamic', 'Транексамовая', 'bright'], ['arbutin', 'Арбутин', 'bright'], ['kojic', 'Койевая', 'bright'],
  ['licorice', 'Солодка', 'bright'], ['glutathione', 'Глутатион', 'bright'], ['vite', 'Витамин E', 'antiox'],
  ['resveratrol', 'Ресвератрол', 'antiox'], ['greentea', 'Зелёный чай', 'antiox'], ['ferulic', 'Феруловая', 'antiox'],
  ['coq10', 'Коэнзим Q10', 'antiox'], ['essential', 'Эфирные масла', 'frag'], ['comedo', 'Может забивать поры', 'pore'],
];
// самые частые — видны в форме сразу, остальные по кнопке «ещё»
export const ACTIVES_MAIN = ['aha', 'bha', 'pha', 'azelaic', 'retinoid', 'spicule', 'vitc', 'niacinamide', 'peptides', 'ceramides',
  'hyaluronic', 'centella', 'panthenol', 'spf', 'alcohol', 'fragrance', 'oil', 'comedo'];

export const SKIN_TYPES = ['Сухая', 'Нормальная', 'Комбинированная', 'Жирная', 'Чувствительная'];

export const ROUTINE_SLOTS = [
  { id: 'morning', name: 'Утро',           icon: 'sun',   tint: C.orange2 },
  { id: 'day',     name: 'Днём',           icon: 'cloud', tint: C.blue },
  { id: 'eveA',    name: 'Вечер · Азелик', icon: 'moon',  tint: C.pink2 },
  { id: 'eveB',    name: 'Вечер · отдых',  icon: 'moon',  tint: C.pink },
  { id: 'weekly',  name: 'Раз в неделю',   icon: 'star',  tint: C.matcha2 },
  { id: 'device',  name: 'Аппарат',        icon: 'device', tint: C.blue2 },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function P(id, o) {
  const p = Object.assign({
    id, name: '', brand: '', cat: 'face', type: 'cream', status: 'use', actives: [],
    opened: '', pao: 12, price: '', volume: '', rating: 0, note: '', color: '', photo: '',
    pauseUntil: '', created: '2026-11-20', fav: false, kit: '', pos: null, url: '', inci: '', rebuy: '',
  }, o);
  if (!p.kit) p.kit = ['use', 'low'].includes(p.status) ? 'bag' : 'shelf';
  return p;
}

export function seedProducts() {
  return [
    P('biodance', { name: 'Коллаген 2в1 умывалка-маска', brand: 'Biodance', type: 'cleanser', actives: ['collagen'], color: C.pink, fav: true }),
    P('zinovit', { name: 'Гель для лица и тела с цинком', brand: 'Циновит', type: 'cleanser', actives: ['zinc'], color: C.matcha2, note: '2–3 раза в неделю на лоб и Т-зону, пену подержать минуту' }),
    P('dokdo', { name: '1025 Dokdo Toner', brand: 'Round Lab', type: 'toner', status: 'order', actives: ['panthenol'], color: C.blue, note: 'Утром протирать ватным диском' }),
    P('anua', { name: 'Rice 70 Glow Milky Toner', brand: 'Anua', type: 'toner', status: 'order', actives: ['rice', 'ceramides', 'niacinamide'], color: C.milk, note: 'Вбивать руками, в сухие дни 2–3 слоя' }),
    P('celimax', { name: 'Тонер', brand: 'Celimax', type: 'toner', status: 'low', color: C.butter }),
    P('althea-mist', { name: 'Rapid Hypochlorous Acid Rescue Mist', brand: 'Dr.Althea', type: 'mist', status: 'order', actives: ['hocl', 'zinc'], color: C.orange, price: 1891, volume: '60 мл' }),
    P('bielenda', { name: 'Skin Clinic Professional тоник', brand: 'Bielenda', type: 'toner', status: 'pause', actives: ['aha'], pauseUntil: '2026-12-20', color: C.lav, note: 'Пауза на время ввода Азелика. Проверь кислоту и % на флаконе' }),
    P('clinique-tonic', { name: 'Тоник', brand: 'Clinique', type: 'toner', status: 'pause', actives: ['bha'], pauseUntil: '2026-12-20', color: C.blue, note: 'Пауза на время ввода Азелика' }),
    P('azelik', { name: 'Азелик гель 15%', brand: 'Азелик', type: 'treatment', actives: ['azelaic'], opened: '2026-11-19', pao: 6, color: C.white, fav: true, kit: 'table', pos: { x: 30, y: 52, r: -12 }, note: 'Первые 2 недели через вечер, потом каждый вечер. На сухую кожу, сверху 345' }),
    P('althea345', { name: '345 Relief Cream', brand: 'Dr.Althea', type: 'cream', status: 'low', actives: ['niacinamide', 'panthenol'], color: C.pink, fav: true, note: 'Лёгкий, под макияж и на ночь' }),
    P('althea147', { name: '147 Barrier Cream', brand: 'Dr.Althea', type: 'cream', actives: ['ceramides'], color: C.caramel2, note: 'Плотный — только на сухие щёки' }),
    P('madeca', { name: 'Madeca Cream Time Revolution', brand: 'Centellian 24', type: 'cream', status: 'low', actives: ['centella'], color: C.cream2 }),
    P('spicules', { name: 'Spicule средство', brand: 'Medicube', type: 'exfoliant', status: 'pause', actives: ['spicule'], pauseUntil: '2026-12-20', color: C.blue, note: 'Колется об подушку. Вернуть раз в неделю в вечер без Азелика' }),
    P('althea-jelly', { name: 'Aqua Marine Jelly Mist (PDRN)', brand: 'Dr.Althea', type: 'mist', status: 'use', kit: 'bag', opened: '2026-01-05', pao: 12, actives: ['hyaluronic', 'panthenol', 'centella', 'collagen'], color: C.blue, price: 2421, note: 'Основа под аппарат AGE-R' }),
    P('age-r', { name: 'AGE-R Booster Pro X2', brand: 'medicube', type: 'device', status: 'use', pao: '', kit: 'bag', color: '#F6F4F0', price: 14000, actives: [], note: 'Аппарат: режимы по плану во вкладке «Аппарат»' }),
    P('roundlab-eye', { name: 'Dokdo Eye Cream', brand: 'Round Lab', type: 'eye', color: C.blue2, fav: true, kit: 'table', pos: { x: 68, y: 48, r: 10 } }),
    P('volufiline', { name: 'Стик с волюфилином', brand: 'Derma Factory', type: 'stick', actives: ['peptides'], color: C.pink2, note: 'Днём по щекам поверх макияжа' }),
    P('skin1004', { name: 'Hyalu-Cica Water-fit Sun Serum', brand: 'Skin1004', type: 'spf', status: 'order', actives: ['spf', 'hyaluronic', 'centella'], color: C.blue, pao: 12 }),
    P('elian', { name: 'Silk Obsession', brand: 'Elian', cat: 'makeup', type: 'foundation', color: C.caramel2, note: 'Для офиса' }),
    P('shiseido', { name: 'Synchro Skin Glow', brand: 'Shiseido', cat: 'makeup', type: 'foundation', color: C.cream2, note: 'Сияющий финиш — на вечер и фото' }),
  ];
}

const S = (product, text, note = '') => ({ id: uid(), product, text, note });

export function seedRoutines() {
  return {
    morning: [
      S('biodance', 'Умыться водой или Biodance'),
      S('dokdo', 'Протереть ватным диском'),
      S('anua', 'Вбить руками'),
      S('roundlab-eye', 'Крем для глаз'),
      S('skin1004', 'SPF на всё лицо', 'По УФ-индексу: до 3 можно пропустить'),
      S('elian', 'Макияж'),
    ],
    day: [
      S('althea-mist', 'Поверх макияжа, если кожа сухая или красная'),
      S('volufiline', 'Сразу после миста — по щекам'),
    ],
    eveA: [
      S('biodance', 'Умыться', '2–3 раза в неделю вместо неё — Циновит на лоб и Т-зону'),
      S('', 'Дождаться, пока кожа полностью высохнет', 'Мист и тоники сегодня не нужны'),
      S('azelik', 'Тонким слоем на лоб и зоны с бугорками'),
      S('althea345', 'Через 2–3 минуты на всё лицо', 'На сухие щёки можно 147'),
      S('roundlab-eye', 'Крем для глаз'),
    ],
    eveB: [
      S('biodance', 'Умыться'),
      S('althea-mist', 'Мист или протереть Dokdo'),
      S('anua', 'В сухие дни 2–3 слоя'),
      S('madeca', '345 или Madeca'),
      S('roundlab-eye', 'Крем для глаз'),
    ],
    weekly: [
      S('biodance', 'Маска Biodance в вечер без Азелика'),
      S('zinovit', 'Циновит 2–3 раза в неделю вместо умывалки'),
    ],
  };
}

// летняя схема: больше защиты и матирования, меньше плотных кремов
export function seedSummer() {
  return {
    morning: [
      S('biodance', 'Умыться'),
      S('dokdo', 'Протереть ватным диском'),
      S('anua', 'Один слой, вбить руками'),
      S('roundlab-eye', 'Крем для глаз'),
      S('skin1004', 'SPF на всё лицо — каждый день', 'УФ 3 и выше: SPF обязателен, даже в облачную погоду'),
      S('elian', 'Макияж, Т-зону — пудрой'),
    ],
    day: [
      S('skin1004', 'Обновить SPF, если долго на улице', 'Каждые 2–3 часа на солнце'),
      S('althea-mist', 'Освежить кожу поверх макияжа'),
    ],
    eveA: [
      S('biodance', 'Умыться'),
      S('', 'Дождаться, пока кожа полностью высохнет'),
      S('azelik', 'Тонким слоем на зоны с бугорками'),
      S('althea345', 'Лёгкий крем на всё лицо'),
      S('roundlab-eye', 'Крем для глаз'),
    ],
    eveB: [
      S('biodance', 'Умыться'),
      S('anua', 'Тонер'),
      S('althea345', 'Лёгкий крем'),
      S('roundlab-eye', 'Крем для глаз'),
    ],
    weekly: [
      S('biodance', 'Маска Biodance в вечер без Азелика'),
      S('zinovit', 'Циновит 2–3 раза в неделю вместо умывалки'),
    ],
  };
}

export function seedDevice() {
  return [
    S('biodance', 'Умыться', 'Утром перед аппаратом — обязательно'),
    S('dokdo', 'Протереть ватным диском'),
    S('althea-jelly', 'Основа: 3–4 нажатия, лицо влажное', 'Для Booster можно 2–3 слоя Anua'),
    { id: uid(), product: 'age-r', text: 'Аппарат — режимы на сегодня', note: '', kind: 'modes' },
    S('', 'Вбить остатки миста'),
    S('roundlab-eye', 'Крем для глаз'),
    S('althea345', 'Крем на лоб и Т-зону'),
    S('althea147', 'Крем на щёки'),
    S('', 'Протереть головку аппарата'),
  ];
}

export const DEVICE_DEFAULTS = { name: 'Medicube AGE-R Booster Pro', arrived: '', mainFrom: '2026-12-17', days: [2, 4, 6, 0], moves: {}, reloc: {} };

export const REMINDER_DEFAULTS = { evening: '20:30', day: '12:00', off: [] };

export function seedState() {
  return {
    schema: 11,
    device: { ...DEVICE_DEFAULTS },
    uv: null,
    uvPlace: null,
    workDays: {},
    fx: 'script',
    season: 'winter',
    altRoutines: seedSummer(),
    spend: [],
    empties: [],
    reminders: { ...REMINDER_DEFAULTS },
    products: seedProducts(),
    routines: Object.assign(seedRoutines(), { device: seedDevice() }),
    profile: {
      name: 'Юлия',
      skin: 'Комбинированная',
      notes: 'Т-зона блестит, щёки сушит батарея. Бугорки на лбу.',
      activeStart: '2026-11-19',
      rampDays: 14,
      activeName: 'Азелик',
    },
    log: {},
    eveMode: {},
    lastBackup: '',
    created: new Date().toISOString(),
  };
}

export const ACTIVE_MAP = Object.fromEntries(ACTIVES.map(([id, name, group]) => [id, { id, name, group }]));
export const TYPE_MAP = Object.fromEntries(Object.entries(TYPES).flatMap(([cat, arr]) => arr.map(([id, name, shape]) => [id, { id, name, shape, cat }])));
export const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
export const SPEND_CATS = [['face', 'Уход'], ['makeup', 'Декоративка'], ['perfume', 'Парфюм'], ['body', 'Тело'], ['hair', 'Волосы'], ['other', 'Другое']];
export const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]));
export { uid };
