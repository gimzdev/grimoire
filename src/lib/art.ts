/**
 * Official World of Warcraft: Forever artwork, served from Blizzard's own CDNs and resized by next/image. Blizzard allows
 * its art on a non-commercial fan site that shows its notices (see /legal). Race, class and zone pages reuse these
 * pictures by theme. A file named <key>.(jpg|png|webp|avif) in public/art replaces the picture for that key, so your
 * own in-game screenshots can take over any slot (zone<id>, race<Name>, class<Name> or any key below).
 */

const CS = 'https://blz-contentstack-images.akamaized.net/v3/assets/blt9c12f249ac15c7ec';
const CMS = 'https://bnetcmsus-a.akamaihd.net/cms';

export interface Art {
  src: string;
  width: number;
  height: number;
  /** Where the eye should land when the picture is cropped (CSS object-position). */
  focus?: string;
  /** Some feature images ship with a painted gold frame; scaling by this factor crops it off. */
  zoom?: number;
  alt: string;
}

const OFFICIAL = {
  // Stills from Forever's launch cinematic (Blizzard's press kit), shipped in public/img at 2880 pixels wide. The front
  // page's background is Zephras Isle; a picture of your own named homeBackground.(avif|webp|jpg|png) in public/art
  // replaces it. The Skyborne still is the front page's Skyborne card, the World Tree closes the front page under the
  // launch timeline and is Mount Hyjal's picture, and Archimonde's skull is the Hyjal Summit raid's.
  homeBackground: { src: '/img/zephras-isle.jpg', width: 2880, height: 1200, focus: '52% 50%', alt: 'Zephras Isle floating above a sea of clouds, ringed by white towers on chains' },
  // Cut from the still at its full resolution, around her and at about the card's own proportions, so the card shows
  // it sharp instead of enlarging a small part of a wide picture.
  skyborneStill: { src: '/img/skyborne-wind.jpg', width: 2240, height: 1600, focus: '50% 15%', alt: 'A Skyborne elf with glowing eyes, arms spread in the wind above the clouds' },
  worldTree: { src: '/img/world-tree.jpg', width: 2880, height: 1200, focus: '48% 50%', alt: 'The World Tree on Mount Hyjal at dusk, blue wisps spiralling around its trunk' },
  archimonde: { src: '/img/archimonde.jpg', width: 2880, height: 1200, focus: '62% 35%', alt: 'Archimonde’s giant skull among the trees of Mount Hyjal, a river of blue wisps winding past it' },
  // The picture beside the new class combinations on the front page, also chosen by the site owner. It ships with the app in public/img, unedited.
  undead: { src: '/img/undead.jpg', width: 3840, height: 1600, focus: '54% 10%', alt: 'A hooded undead warrior in spiked plate raising a blazing golden warhammer in a dark cavern' },
  keyArt: { src: `${CS}/blt4d412035d16da095/6aa204fb2c0580bfcf273e54/masthead-art.jpg`, width: 2600, height: 1725, focus: '62% 38%', alt: 'World of Warcraft: Forever key art: adventurers above a valley, Dalaran on the horizon' },
  paintedVista: { src: `${CMS}/blog_header/4f/4FC5K327AVF01789243118942.png`, width: 2400, height: 1350, focus: '50% 40%', alt: 'Painted vista of mountains and forest under a wide sky' },
  paintedValley: { src: `${CS}/blte2e5cd42dc134ef1/6aa305a3dee8848ed5cbac3d/background-art.png`, width: 2600, height: 1784, focus: '50% 55%', alt: 'Painted valley with ruins and distant peaks' },
  skyborne: { src: `${CS}/blt86ec9f1909d2e4f3/6a99ff068102310aeb81e0de/Skyborne-BG.jpg`, width: 2600, height: 1500, focus: '62% 30%', alt: 'A Skyborne elf above a sea of clouds' },
  zephras: { src: `${CMS}/blog_header/to/TO55V6TRR1RW1790054798721.png`, width: 2400, height: 1350, focus: '55% 45%', alt: 'Zephras Isle: wind-carved towers above the clouds' },
  zephrasVillage: { src: `${CMS}/content_entry_media/LS6U1F93JLU21790055304501.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'A Skyborne village on Zephras Isle' },
  zephrasShore: { src: `${CMS}/content_entry_media/SIEMA173U1BK1790055304500.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'Misty shoreline of Zephras Isle' },
  zephrasGrove: { src: `${CMS}/content_entry_media/MAIN14P3DBAW1790055306464.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'A shrine among red-leaved trees on Zephras Isle' },
  zephrasMeadow: { src: `${CMS}/content_entry_media/2FS1WI12FTFF1790055304492.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'Green terraces of Zephras Isle' },
  zephrasDusk: { src: `${CMS}/content_entry_media/VNUVL6VY9G7G1790055107744.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'Dusk over a Skyborne watchtower' },
  rulesets: { src: `${CMS}/blog_header/1p/1PD2ZLVROZOB1789961389530.png`, width: 2400, height: 1350, focus: '50% 50%', alt: 'Moonlit night elf village' },
  legacy: { src: `${CMS}/blog_header/q7/Q7DCITNH6C9A1790133996517.png`, width: 2400, height: 1350, focus: '30% 50%', alt: 'The Legacy window over a coral shoreline' },
  trailer: { src: `${CS}/blt2ba5c8ba05a5aed8/6aa43f0b203da39637f0e411/Cinematic_Trailer.jpg`, width: 2600, height: 1463, focus: '50% 60%', zoom: 1.1, alt: 'A dwarf hunter and his bear crossing a sunlit valley' },
  untoldStories: { src: `${CS}/blt4865ad3281f25cb8/6aa09df51deff31ac7439163/Explore_Untold_Stories.jpg`, width: 2600, height: 1463, focus: '50% 40%', zoom: 1.1, alt: 'Adventurers gathered at a quest giver' },
  expanses: { src: `${CS}/blt491397daad992c6d/6aa09e0ec751e10dc30c50e0/Soak_in_Breathtaking_Expanses.jpg`, width: 2600, height: 1463, focus: '50% 50%', zoom: 1.1, alt: 'Sunbeams through a misty green forest' },
  unknownPaths: { src: `${CS}/blt7a58f20dd8f6b2d9/6aa09f1c7ec8fef91000059e/Take_Unknown_Paths.jpg`, width: 2600, height: 1463, focus: '50% 40%', zoom: 1.1, alt: 'A troll adventurer in a mossy cave' },
  newPower: { src: `${CS}/blt2dc686732f526be5/6aa09db81deff3540b439161/Claim_New_Power.jpg`, width: 2600, height: 1463, focus: '45% 40%', zoom: 1.1, alt: 'A dwarf shaman channelling lightning' },
  // Blizzard's own screenshot of the Hall of Thanes, from its preview of Forever's new dungeons.
  hallOfThanes: { src: `${CMS}/content_entry_media/XRAT25OFDIIQ1792014832498.png`, width: 1280, height: 720, focus: '40% 50%', alt: 'A stone thane statue in the dim burial vaults of the Hall of Thanes' },
  // Blizzard's own screenshots from its Forever news posts (news.blizzard.com), each of the place it names.
  ruinsOfLordaeron: { src: `${CMS}/content_entry_media/GTBUD9QLE3XW1792014833094.png`, width: 1280, height: 720, focus: '45% 50%', alt: 'An abomination lumbering through the green-lit Ruins of Lordaeron' },
  whelgarsExcavation: { src: `${CMS}/content_entry_media/TFBBUPOTALTZ1792014832338.png`, width: 1280, height: 720, focus: '30% 60%', alt: 'Giant bones in the grass of the Wetlands dig above Whelgar’s Excavation' },
  dalaranCity: { src: `${CMS}/content_entry_media/ha/HARQTHBQCYMR1792014060266.png`, width: 1280, height: 720, focus: '50% 45%', alt: 'Violet banners on the steps of a Dalaran citadel' },
  drownedCity: { src: `${CMS}/content_entry_media/IM7F57KLDDNN1792014830908.png`, width: 1280, height: 720, focus: '50% 55%', alt: 'Pink coral and a sunken wreck in the shallows of the Drowned City' },
  kroldokStronghold: { src: `${CMS}/content_entry_media/8K0OPATZI1MN1792014832735.png`, width: 1280, height: 720, focus: '50% 55%', alt: 'Ogre huts and banners at Krol’dok Stronghold' },
  alcazPrison: { src: `${CMS}/content_entry_media/QBF73F8ILIWZ1792014830857.png`, width: 1280, height: 720, focus: '50% 55%', alt: 'Two hulking guards in a mossy corridor of Alcaz Prison' },
  blackmawHold: { src: `${CMS}/content_entry_media/LXIRE6TZL7KF1792014830769.png`, width: 1280, height: 720, focus: '45% 55%', alt: 'A furbolg totem among the red trees outside Blackmaw Hold' },
  shapersTerrace: { src: `${CMS}/content_entry_media/N8SVJYXN9MAU1792014833421.png`, width: 1280, height: 720, focus: '45% 55%', alt: 'A glowing titan terrace deep in the jungle of Un’Goro' },
  barrowDeeps: { src: `${CMS}/content_entry_media/GDL98CW02PR11792099110823.png`, width: 1280, height: 720, focus: '50% 50%', alt: 'A frozen blue cavern in the Barrow Deeps' },
  hyjalPeak: { src: `${CMS}/content_entry_media/3NTG3SPS5EZS1792099110937.png`, width: 1280, height: 720, focus: '35% 50%', alt: 'A ruined night elf tower and arch under a pink sky on Hyjal Summit' },
  mountHyjal: { src: `${CMS}/content_entry_media/hl/HLED7ABL57AT1789335246431.png`, width: 1280, height: 619, focus: '50% 45%', alt: 'Violet peaks and pine forests of Mount Hyjal' },
  onyxiasLair: { src: `${CMS}/content_entry_media/yx/YXLZY2IB88LB1792099381075.png`, width: 1280, height: 720, focus: '50% 55%', alt: 'The fiery cavern of Onyxia’s Lair' },
  stormwind: { src: `${CMS}/content_entry_media/7j/7J9HNHWVCNED1790052260790.png`, width: 1920, height: 1080, focus: '60% 50%', alt: 'Stormwind’s white walls and harbor seen from the water' },
  orgrimmar: { src: `${CMS}/blog_header/md/MD8WVKVK66W31790051503373.png`, width: 2400, height: 1350, focus: '50% 45%', alt: 'Orgrimmar’s spiked towers against a blazing sunset' },
  dunMorogh: { src: `${CMS}/content_entry_media/CAZYRU21CWCS1789247718136.png`, width: 1920, height: 1080, focus: '50% 35%', alt: 'A dwarf on a frozen lake among the snowy pines of Dun Morogh' },
  duskwood: { src: `${CMS}/content_entry_media/e6/E6M8FPNN5PIW1789249925638.png`, width: 1920, height: 1080, focus: '60% 50%', alt: 'Green mist over Darkshire and its clock tower in Duskwood' },
  riverglades: { src: `${CMS}/content_entry_media/6m/6MZPXKWH7QCL1789334859808.png`, width: 1280, height: 618, focus: '50% 50%', alt: 'Red-roofed homesteads among the rivers and grasslands of the Riverglades' },
  shendralas: { src: `${CMS}/content_entry_media/fo/FOU74XKXWD931789247935672.png`, width: 3840, height: 2160, focus: '55% 50%', alt: 'A Highborne pavilion by glowing water under violet trees' },
  darkspearIslands: { src: `${CMS}/content_entry_media/RG38F8CTEXDG1790890631374.png`, width: 1280, height: 720, focus: '50% 50%', alt: 'The red cliffs and jungle of the Darkspear Islands from above' },
  alteracValley: { src: `${CMS}/blog_header/ab/ABQG457IQXQF1790901647323.png`, width: 2400, height: 1350, focus: '50% 55%', alt: 'Fighters clashing on a snowy road in Alterac Valley' },
  // Blizzard's own in-game screenshots of the classic world, from its WoW Classic posts (2019 city tours, launch primer,
  // Hardcore, Season of Discovery and raid releases).
  ironforgeCity: { src: `${CMS}/blog_header/8o/8O1A97BC3B7K1569342314291.jpg`, width: 2400, height: 1350, focus: '50% 45%', alt: 'Torch-lit stone halls of Ironforge' },
  stormwindGate: { src: `${CMS}/blog_header/8b/8BIKZFGNMCEW1568413423399.jpg`, width: 2400, height: 1350, focus: '50% 50%', alt: 'The gate of Stormwind City and its statues' },
  undercityCity: { src: `${CMS}/blog_header/db/DBL5AH5UT1HN1569603616452.jpg`, width: 2400, height: 1350, focus: '50% 45%', alt: 'The royal quarter of the Undercity' },
  thunderBluff: { src: `${CMS}/blog_header/7w/7WK6ZKHK4M8S1570206486645.jpg`, width: 2400, height: 1350, focus: '50% 55%', alt: 'Tents and totems on the mesas of Thunder Bluff' },
  elwynn: { src: `${CMS}/content_entry_media/3NZ4LNMV3QK61565217358499.jpg`, width: 1280, height: 720, focus: '55% 55%', alt: 'A blue-roofed stone building among the trees of Elwynn Forest' },
  westfall: { src: `${CMS}/blog_header/pq/PQE81VV3Q9DV1636741444102.jpg`, width: 2400, height: 1350, focus: '60% 55%', alt: 'Haystacks and a harvest golem in the golden fields of Westfall' },
  stranglethorn: { src: `${CMS}/blog_header/fo/FOB9MIG4G2VP1691526616872.jpg`, width: 2400, height: 1350, focus: '45% 55%', alt: 'A Bloodsail ship off the coast of Stranglethorn Vale' },
  durotar: { src: `${CMS}/blog_header/ho/HOMWDV8LS2XY1691687030980.png`, width: 2400, height: 1350, focus: '50% 55%', alt: 'Orcish towers and palisades on the red rock of Durotar' },
  gnomeregan: { src: `${CMS}/blog_header/0a/0AFE5X3VH27I1707268839202.png`, width: 2400, height: 1350, focus: '50% 50%', alt: 'The great gate of Gnomeregan in the snows of Dun Morogh' },
  azshara: { src: `${CMS}/blog_header/nv/NVIRY4AC0H3D1573576178890.jpg`, width: 2400, height: 1350, focus: '45% 50%', alt: 'Azuregos among the autumn trees of Azshara' },
  plaguelands: { src: `${CMS}/content_entry_media/h8/H8ENHERCG5NY1606959280913.jpg`, width: 1280, height: 720, focus: '50% 50%', alt: 'A chapel on a blighted hill under the red sky of the Eastern Plaguelands' },
  moltenCore: { src: `${CMS}/content_entry_media/AO2N97619I2S1565217358953.jpg`, width: 1280, height: 720, focus: '45% 45%', alt: 'Ragnaros rising from the lava of the Molten Core' },
  blackwingLair: { src: `${CMS}/content_entry_media/mn/MNBURVX9NNQ01581114125564.jpg`, width: 1280, height: 720, focus: '50% 40%', alt: 'A black dragon over a fight in Blackwing Lair' },
  zulGurub: { src: `${CMS}/content_entry_media/IXON73Y4P82A1586887709775.jpg`, width: 1280, height: 720, focus: '40% 45%', alt: 'Hakkar before his temple in Zul’Gurub' },
  ahnQiraj: { src: `${CMS}/blog_header/ne/NE54UUETD8571596487657201.jpg`, width: 2400, height: 1350, focus: '50% 45%', alt: 'C’Thun in the depths of the Temple of Ahn’Qiraj' },
  sunkenTemple: { src: `${CMS}/content_entry_media/3MSM4T3SCNZ71711141989979.png`, width: 1280, height: 720, focus: '50% 50%', alt: 'Troll statues along a hall of the Sunken Temple' },
  direMaul: { src: `${CMS}/blog_header/1m/1MAPLTII55FJ1570819145531.jpg`, width: 2400, height: 1350, focus: '50% 50%', alt: 'A Gordok ogre in the ruined courtyards of Dire Maul' },
  stratholme: { src: `${CMS}/content_entry_media/X7Z19UTRJYI31565217359399.jpg`, width: 1280, height: 720, focus: '50% 50%', alt: 'Burning streets of Stratholme' },
  // The in-game world map, for places Blizzard has never published a screenshot of.
  worldMap: { src: `${CMS}/content_entry_media/3YIZDYPYLPTK1565217358854.jpg`, width: 1280, height: 720, focus: '50% 50%', alt: 'The world map of Kalimdor and the Eastern Kingdoms' },
  // Painted panel art from BlizzCon 2026: Azeroth in general, for pages no official picture shows.
  paintedFrontier: { src: `${CMS}/blog_header/6i/6IHESZC8SP111789292807115.png`, width: 2400, height: 1350, focus: '50% 50%', alt: 'Painted landscape of lakes, forests and snowy peaks at sunset' },
  paintedHeroes: { src: `${CMS}/blog_thumbnail/4g/4GXARI8349F21789293441352.png`, width: 1920, height: 1080, focus: '60% 50%', alt: 'Painted adventurers looking out over a valley toward distant mountains' },
  paintedDusk: { src: `${CMS}/blog_thumbnail/ym/YM2GNSKTB2WT1789247567739.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'Painted figures on a ridge before a violet tower at dusk' },
  camp: { src: `${CS}/blt50839e89a98e4d22/6aa09f512437ed84d9d48846/System_Revamps.jpg`, width: 2600, height: 1463, focus: '50% 55%', zoom: 1.1, alt: 'A campfire and tent at the edge of a forest' },
  ashenvale: { src: `${CS}/blt58abba267979c75c/6a985e232437ed4648d48726/Updates_Ashenvale_01.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'Violet canopy of Ashenvale' },
  ashenvaleGlade: { src: `${CS}/bltaea7929ebe6f9a8b/6a985e239b942e3ba6f7426b/Updates_Ashenvale_02.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'A moonwell glade in Ashenvale' },
  darkshore: { src: `${CS}/blt7c732bea431c18cf/6a985e239b942e1f62f74267/Updates_Darkshore.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'Grey surf along the Darkshore coast' },
  dustwallow: { src: `${CS}/blt7bdf8e7ba8e4b30a/6a985e232c05804582273c55/Updates_Dustwallow.jpg`, width: 2600, height: 1462, focus: '50% 60%', alt: 'A torch-lit boardwalk through Dustwallow Marsh' },
  felwood: { src: `${CS}/blt013749cb805b2c05/6a985e23dee884432bcba951/Updates_Felwood.jpg`, width: 2600, height: 1462, focus: '50% 60%', alt: 'Corrupted pools glowing green in Felwood' },
  mulgore: { src: `${CS}/bltf8ea7f909345c09b/6a985e23203da3e3fcf0e10e/Updates_Mulgore.jpg`, width: 2600, height: 1462, focus: '40% 45%', alt: 'Sunset over the mesas of Mulgore' },
  barrens: { src: `${CS}/blta4c0f5c59e8c1615/6a985e243ad3924af56f8e16/Updates_TheBarrens.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'Open savanna of the Barrens' },
  dalaranNight: { src: `${CS}/blt09d4f876d494a584/6aa1ead14b66aa844291d284/masthead-bg-sm.jpg`, width: 960, height: 1880, focus: '50% 30%', alt: 'Violet spires of Dalaran' },
  raceNightElf: { src: `${CMS}/blog_header/1p/1PD2ZLVROZOB1789961389530.png`, width: 2400, height: 1350, focus: '50% 50%', alt: 'Moonlit Darnassus on Teldrassil' },
  raceTauren: { src: `${CS}/bltf8ea7f909345c09b/6a985e23203da3e3fcf0e10e/Updates_Mulgore.jpg`, width: 2600, height: 1462, focus: '40% 45%', alt: 'Sunset over the mesas of Mulgore' },
  raceHighOrder: { src: `${CMS}/blog_header/to/TO55V6TRR1RW1790054798721.png`, width: 2400, height: 1350, focus: '55% 45%', alt: 'Zephras Isle: wind-carved towers above the clouds' },
  raceWindshaper: { src: `${CMS}/content_entry_media/MAIN14P3DBAW1790055306464.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'A shrine among red-leaved trees on Zephras Isle' },
} satisfies Record<string, Art>;

/** Race and class pages use the official picture that fits them best. */
export const ART = {
  ...OFFICIAL,
  // Every race and class page: an in-game landscape (no interface, no posed character, no cinematic still).
  // Races show their homeland.
  raceHuman: OFFICIAL.stormwind,
  raceDwarf: OFFICIAL.ironforgeCity,
  raceGnome: OFFICIAL.gnomeregan,
  raceOrc: OFFICIAL.orgrimmar,
  raceUndead: OFFICIAL.undercityCity,
  raceTroll: OFFICIAL.darkspearIslands,
  classWarrior: OFFICIAL.alteracValley,
  classPaladin: OFFICIAL.stormwind,
  classHunter: OFFICIAL.riverglades,
  classRogue: OFFICIAL.duskwood,
  classPriest: OFFICIAL.shendralas,
  classShaman: OFFICIAL.zephrasGrove,
  classMage: OFFICIAL.dalaranCity,
  classWarlock: OFFICIAL.felwood,
  classDruid: OFFICIAL.ashenvaleGlade,
} satisfies Record<string, Art>;

export type ArtKey = keyof typeof ART;

export const CLASS_ART: Record<string, ArtKey> = {
  warrior: 'classWarrior',
  paladin: 'classPaladin',
  hunter: 'classHunter',
  rogue: 'classRogue',
  priest: 'classPriest',
  shaman: 'classShaman',
  mage: 'classMage',
  warlock: 'classWarlock',
  druid: 'classDruid',
};

/** The picture for each zone, by the zone ids in data/zones.json: an official picture of the same kind of place. */
const ZONE_THEME: Record<ArtKey, number[]> = {
  // Only in-game screenshots of the place itself (or the city, dungeon or zone it sits in). A place Blizzard has never
  // shown gets the in-game world map; your own screenshot in public/art/zone<id>.jpg replaces either.
  zephras: [16593],
  riverglades: [16591],
  shendralas: [16651],
  darkspearIslands: [16606],
  gnomeregan: [1, 721],
  ironforgeCity: [1537],
  stormwindGate: [1519, 717],
  elwynn: [12],
  westfall: [40],
  duskwood: [10],
  stranglethorn: [33],
  whelgarsExcavation: [11],
  ruinsOfLordaeron: [85],
  undercityCity: [1497],
  plaguelands: [139],
  stratholme: [2017],
  moltenCore: [25, 2717],
  blackwingLair: [2677],
  zulGurub: [1977],
  sunkenTemple: [1477],
  orgrimmar: [1637, 2437],
  durotar: [14],
  barrens: [17],
  mulgore: [215],
  thunderBluff: [1638],
  rulesets: [1657, 141],
  darkshore: [148],
  ashenvale: [331, 3277],
  felwood: [361],
  azshara: [16],
  dustwallow: [15],
  onyxiasLair: [2159],
  direMaul: [2557],
  shapersTerrace: [490],
  ahnQiraj: [3428],
  mountHyjal: [616],
  alteracValley: [2597],
  // Inside a zone whose picture shows somewhere else
  worldMap: [1584, 1583, 796],
} as Record<ArtKey, number[]>;

export const ZONE_ART: Record<number, ArtKey> = Object.fromEntries(
  Object.entries(ZONE_THEME).flatMap(([key, ids]) => ids.map((id) => [id, key as ArtKey])),
);

export const SECTION_ART: Record<string, ArtKey> = {
  home: 'homeBackground',
  talents: 'expanses',
  classes: 'hyjalPeak',
  races: 'zephrasMeadow',
  items: 'camp',
  world: 'ashenvale',
  dungeons: 'blackmawHold',
  guides: 'darkshore',
  tools: 'camp',
  forever: 'zephras',
  search: 'darkshore',
  quests: 'riverglades',
};
