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
  camp: { src: `${CS}/blt50839e89a98e4d22/6aa09f512437ed84d9d48846/System_Revamps.jpg`, width: 2600, height: 1463, focus: '50% 55%', zoom: 1.1, alt: 'A campfire and tent at the edge of a forest' },
  ashenvale: { src: `${CS}/blt58abba267979c75c/6a985e232437ed4648d48726/Updates_Ashenvale_01.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'Violet canopy of Ashenvale' },
  ashenvaleGlade: { src: `${CS}/bltaea7929ebe6f9a8b/6a985e239b942e3ba6f7426b/Updates_Ashenvale_02.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'A moonwell glade in Ashenvale' },
  darkshore: { src: `${CS}/blt7c732bea431c18cf/6a985e239b942e1f62f74267/Updates_Darkshore.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'Grey surf along the Darkshore coast' },
  dustwallow: { src: `${CS}/blt7bdf8e7ba8e4b30a/6a985e232c05804582273c55/Updates_Dustwallow.jpg`, width: 2600, height: 1462, focus: '50% 60%', alt: 'A torch-lit boardwalk through Dustwallow Marsh' },
  felwood: { src: `${CS}/blt013749cb805b2c05/6a985e23dee884432bcba951/Updates_Felwood.jpg`, width: 2600, height: 1462, focus: '50% 60%', alt: 'Corrupted pools glowing green in Felwood' },
  mulgore: { src: `${CS}/bltf8ea7f909345c09b/6a985e23203da3e3fcf0e10e/Updates_Mulgore.jpg`, width: 2600, height: 1462, focus: '40% 45%', alt: 'Sunset over the mesas of Mulgore' },
  barrens: { src: `${CS}/blta4c0f5c59e8c1615/6a985e243ad3924af56f8e16/Updates_TheBarrens.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'Open savanna of the Barrens' },
  dalaranNight: { src: `${CS}/blt09d4f876d494a584/6aa1ead14b66aa844291d284/masthead-bg-sm.jpg`, width: 960, height: 1880, focus: '50% 30%', alt: 'Violet spires of Dalaran' },
  raceNightElf: { src: `${CS}/bltaea7929ebe6f9a8b/6a985e239b942e3ba6f7426b/Updates_Ashenvale_02.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'A moonwell glade in Ashenvale' },
  raceTauren: { src: `${CS}/bltf8ea7f909345c09b/6a985e23203da3e3fcf0e10e/Updates_Mulgore.jpg`, width: 2600, height: 1462, focus: '40% 45%', alt: 'Sunset over the mesas of Mulgore' },
  raceHighOrder: { src: `${CMS}/blog_header/to/TO55V6TRR1RW1790054798721.png`, width: 2400, height: 1350, focus: '55% 45%', alt: 'Zephras Isle: wind-carved towers above the clouds' },
  raceWindshaper: { src: `${CMS}/content_entry_media/MAIN14P3DBAW1790055306464.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'A shrine among red-leaved trees on Zephras Isle' },
} satisfies Record<string, Art>;

/** Race and class pages use the official picture that fits them best. */
export const ART = {
  ...OFFICIAL,
  raceHuman: OFFICIAL.paintedValley,
  raceDwarf: OFFICIAL.newPower,
  raceGnome: OFFICIAL.paintedVista,
  raceOrc: OFFICIAL.barrens,
  raceUndead: OFFICIAL.undead,
  raceTroll: OFFICIAL.unknownPaths,
  classWarrior: OFFICIAL.keyArt,
  classPaladin: OFFICIAL.undead,
  classHunter: OFFICIAL.trailer,
  classRogue: OFFICIAL.rulesets,
  classPriest: OFFICIAL.legacy,
  classShaman: OFFICIAL.newPower,
  classMage: OFFICIAL.dalaranNight,
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
  paintedVista: [1, 267, 36, 16591, 406, 618, 2597],
  paintedValley: [12, 44, 45, 1337, 3358],
  mulgore: [3, 51, 46, 215, 400, 1638, 722, 491],
  newPower: [25, 1537, 1584, 1583, 721, 2677, 2717],
  felwood: [4, 28, 139, 361, 2017, 3456],
  rulesets: [10, 85, 130, 1657, 141, 796, 2057, 209],
  trailer: [40, 38, 1581],
  keyArt: [1519, 717],
  darkshore: [11, 16, 148, 719],
  expanses: [47, 357, 2557],
  worldTree: [616],
  unknownPaths: [33, 490, 2100, 1477, 1977, 16606],
  dustwallow: [8, 15, 2159],
  undead: [1497],
  ashenvale: [331, 3277],
  ashenvaleGlade: [493],
  barrens: [405, 14, 1637, 1377, 440, 17, 2437, 718, 1176, 3428, 3429],
  untoldStories: [16651],
  zephras: [16593],
} as Record<ArtKey, number[]>;

export const ZONE_ART: Record<number, ArtKey> = Object.fromEntries(
  Object.entries(ZONE_THEME).flatMap(([key, ids]) => ids.map((id) => [id, key as ArtKey])),
);

export const SECTION_ART: Record<string, ArtKey> = {
  home: 'homeBackground',
  talents: 'expanses',
  classes: 'keyArt',
  races: 'skyborne',
  items: 'camp',
  world: 'ashenvale',
  dungeons: 'dustwallow',
  guides: 'paintedVista',
  tools: 'camp',
  forever: 'zephras',
  search: 'darkshore',
  quests: 'untoldStories',
};
