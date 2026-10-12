/**
 * Official World of Warcraft: Forever artwork, served from Blizzard's CDNs, and in-game screenshots from Wowhead's
 * gallery for the race, class and zone pages, resized by next/image. A file named <key>.(jpg|png|webp|avif) in
 * public/art replaces the remote picture.
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

export const ART = {
  // The front page's background, chosen by the site owner. It ships with the app in public/img, unedited.
  homeBackground: { src: '/img/home-background.png', width: 1535, height: 605, focus: '38% 50%', alt: 'A castle on a lake below steep peaks at sunset, with a meadow of yellow flowers in front' },
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
  // One slot per race and class page background. Drop public/art/<slot>.jpg to replace it.
  raceHuman: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175161.jpg', width: 1920, height: 1200, focus: '50% 60%', alt: 'A still lake under oak trees at dusk in Elwynn Forest' },
  raceDwarf: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/148500.jpg', width: 1680, height: 1058, focus: '50% 55%', alt: 'A snowy valley of firs and a winding road in Dun Morogh' },
  raceGnome: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/174301.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'Snowy fir hills in Dun Morogh' },
  raceNightElf: { src: `${CS}/bltaea7929ebe6f9a8b/6a985e239b942e3ba6f7426b/Updates_Ashenvale_02.jpg`, width: 2600, height: 1462, focus: '50% 50%', alt: 'A moonwell glade in Ashenvale' },
  raceOrc: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179142.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Red rock spires under an orange sky in Durotar' },
  raceTroll: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1241758.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Palm trees and tall reeds beside a lake in Durotar' },
  raceUndead: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/628081.jpg', width: 1680, height: 1050, focus: '50% 50%', alt: 'A full moon over a foggy lake and dark pines in Tirisfal Glades' },
  raceTauren: { src: `${CS}/bltf8ea7f909345c09b/6a985e23203da3e3fcf0e10e/Updates_Mulgore.jpg`, width: 2600, height: 1462, focus: '40% 45%', alt: 'Sunset over the mesas of Mulgore' },
  raceHighOrder: { src: `${CMS}/blog_header/to/TO55V6TRR1RW1790054798721.png`, width: 2400, height: 1350, focus: '55% 45%', alt: 'Zephras Isle: wind-carved towers above the clouds' },
  raceWindshaper: { src: `${CMS}/content_entry_media/MAIN14P3DBAW1790055306464.png`, width: 1920, height: 1080, focus: '50% 50%', alt: 'A shrine among red-leaved trees on Zephras Isle' },
  classWarrior: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/213707.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A low sun over fiery red mountains in the Burning Steppes' },
  classPaladin: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/255824.jpg', width: 1920, height: 1080, focus: '50% 50%', alt: 'A column of light rising from a tower at night in the Eastern Plaguelands' },
  classHunter: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175341.jpg', width: 1920, height: 1200, focus: '50% 60%', alt: 'Palm trees on a beach at sunset in Stranglethorn Vale' },
  classRogue: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/86209.jpg', width: 1600, height: 1200, focus: '50% 45%', alt: 'A huge tree and a house under a pale moon in a teal night' },
  classPriest: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/286584.jpg', width: 1920, height: 1080, focus: '50% 22%', alt: 'Golden rooftops and spires of Stormwind seen from the Cathedral district' },
  classShaman: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/144196.jpg', width: 1920, height: 1080, focus: '50% 50%', alt: 'A rope bridge between red mesas under a pink sunset in Thousand Needles' },
  classMage: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/99691.jpg', width: 1680, height: 1050, focus: '50% 40%', alt: 'The violet spires of Dalaran' },
  classWarlock: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/67126.jpg', width: 1680, height: 1050, focus: '50% 25%', alt: 'The green Dark Portal between two stone statues in the Blasted Lands' },
  classDruid: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/176236.jpg', width: 1920, height: 1200, focus: '50% 60%', alt: 'A forest clearing with magenta-leaved trees and purple lights in Feralas' },
  // One picture per zone: an in-game screenshot of the place itself. Drop public/art/zone<id>.jpg to replace one.
  zone1: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179212.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Snow-capped blue mountains in Dun Morogh' },
  zone3: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175153.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Sunset over the red rocks of the Badlands' },
  zone4: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179186.jpg', width: 1920, height: 1200, focus: '50% 72%', alt: 'A shipwreck on the shore under a purple sky in the Blasted Lands' },
  zone8: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/395538.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A low orange sun over the Swamp of Sorrows' },
  zone10: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179216.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'An old dark building among giant trees at night in Duskwood' },
  zone11: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175197.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A stone keep among dark trees below purple mountains in the Wetlands' },
  zone12: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/611952.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'Sunset behind the mountains above Elwynn Forest' },
  zone14: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1241831.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Red rock plains in Durotar' },
  zone16: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179133.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Ruined walls on a dusky hillside in Azshara' },
  zone25: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/226227.jpg', width: 1366, height: 768, focus: '50% 55%', alt: 'A low sun over the red peaks of Blackrock Mountain' },
  zone28: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/168711.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Pines and a pale moon in a red haze over the Western Plaguelands' },
  zone33: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1240728.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Palms and ferns under a peach sky in Stranglethorn Vale' },
  zone36: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/171991.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'A tower under a pale moon in the Alterac Mountains' },
  zone38: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175169.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Sunset over pine-covered hills in Loch Modan' },
  zone40: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1263984.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Golden fields and scattered trees in Westfall' },
  zone41: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/21965.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'Bare twisted trees and grey cliffs in Deadwind Pass' },
  zone44: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179245.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Autumn-orange trees below a tower in the Redridge Mountains' },
  zone45: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1282875.jpg', width: 1600, height: 900, focus: '50% 60%', alt: 'Misty mountains above green hills in the Arathi Highlands' },
  zone46: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/111168.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'Red mountains under a burning sky in the Burning Steppes' },
  zone47: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/181945.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'A great tree rising over the forest in the Hinterlands' },
  zone51: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1282113.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Dark crags under an orange sky in the Searing Gorge' },
  zone85: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175179.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A still lake among dark pines at night in Tirisfal Glades' },
  zone130: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179268.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A gothic building lit in purple among the dark pines of Silverpine Forest' },
  zone139: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175159.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A tower on a hill in orange haze in the Eastern Plaguelands' },
  zone209: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/524072.jpg', width: 1422, height: 806, focus: '50% 55%', alt: 'The grey walls of Shadowfang Keep in the mist' },
  zone267: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179222.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A wooden tower and shafts of light over the meadows of Hillsbrad Foothills' },
  zone357: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/8963.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'A lush forest with a purple-blossomed tree in Feralas' },
  zone400: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/9229.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'Mesas joined by a rope bridge in Thousand Needles' },
  zone405: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/176234.jpg', width: 1920, height: 1200, focus: '50% 60%', alt: 'A camp of wooden huts with red banners in Desolace' },
  zone406: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/178845.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A mossy stone building among the trees of the Stonetalon Mountains' },
  zone440: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/176248.jpg', width: 1920, height: 1200, focus: '50% 45%', alt: 'Orange rock formations above a turquoise lagoon in Tanaris' },
  zone490: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/227317.jpg', width: 1843, height: 1152, focus: '50% 55%', alt: "Giant vines and ferns in Un'Goro Crater" },
  zone491: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/420641.jpg', width: 2560, height: 1440, focus: '50% 55%', alt: 'Thorny vines and timber inside Razorfen Kraul' },
  zone493: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/234759.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: "Small wooded islands in Lake Elune'ara in Moonglade" },
  zone616: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1240893.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Giant trees under a purple sky on Mount Hyjal' },
  zone618: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1290497.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Snow-covered pines and purple-leaved trees in Winterspring' },
  zone717: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1291791.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A lamp post and a tree on an overcast Stormwind street' },
  zone718: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/384533.jpg', width: 1366, height: 768, focus: '50% 55%', alt: 'Giant ferns and jungle plants at the Wailing Caverns' },
  zone719: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/237970.jpg', width: 1280, height: 800, focus: '50% 55%', alt: 'A teal stone chamber with a golden altar in Blackfathom Deeps' },
  zone721: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/289728.jpg', width: 1377, height: 814, focus: '50% 55%', alt: 'Blue metal plating at Gnomeregan' },
  zone722: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/238060.jpg', width: 1280, height: 800, focus: '50% 55%', alt: 'A glowing cave mouth in Razorfen Downs' },
  zone796: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/265684.jpg', width: 1280, height: 750, focus: '50% 55%', alt: 'The green-lit walls of the Scarlet Monastery' },
  zone1176: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/356119.jpg', width: 1920, height: 1018, focus: '50% 55%', alt: "A carved orange stone temple front at Zul'Farrak" },
  zone1337: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/285409.jpg', width: 1366, height: 768, focus: '50% 55%', alt: 'Stone pillars lit by teal light in Uldaman' },
  zone1377: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/176652.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'Crystal spires under an orange sky in Silithus' },
  zone1397: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1271813.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A green forest in the mist' },
  zone1417: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/11145.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'Stone pillars in a dark teal temple' },
  zone1477: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/74647.jpg', width: 1280, height: 800, focus: '50% 55%', alt: "Serpent statues in green light at the Temple of Atal'Hakkar" },
  zone1497: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179285.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Grey ruined stonework at the Undercity' },
  zone1519: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1291792.jpg', width: 1600, height: 900, focus: '50% 55%', alt: "Stormwind's rooftops and keep under an overcast sky" },
  zone1537: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/327671.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'The snowy mountain face of Ironforge' },
  zone1581: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/657648.jpg', width: 1912, height: 1069, focus: '50% 55%', alt: 'Ships moored in the Deadmines cavern' },
  zone1583: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/274765.jpg', width: 1280, height: 1024, focus: '50% 55%', alt: 'Red peaks under a burning sky at Blackrock Mountain' },
  zone1584: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/76824.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'A bridge over lava in Blackrock Depths' },
  zone1637: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/165346.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'The red-roofed buildings of Orgrimmar' },
  zone1638: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/136893.jpg', width: 1680, height: 994, focus: '50% 55%', alt: 'A bright sky over the cliffs of Thunder Bluff' },
  zone1657: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/184475.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'A pillared gazebo among purple trees in Darnassus' },
  zone1941: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/174662.jpg', width: 1680, height: 1050, focus: '50% 60%', alt: 'A beach with palm trees in Tanaris' },
  zone1977: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/996671.jpg', width: 1600, height: 900, focus: '50% 55%', alt: "A jungle temple among ferns at Zul'Gurub" },
  zone2017: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/172390.jpg', width: 1312, height: 820, focus: '50% 55%', alt: 'An orange-lit gate tower at Stratholme' },
  zone2057: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/215876.jpg', width: 1347, height: 830, focus: '50% 55%', alt: 'A hall lit by red candelabras in Scholomance' },
  zone2100: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/391925.jpg', width: 1552, height: 970, focus: '50% 55%', alt: 'A green and teal cavern opening in Maraudon' },
  zone2159: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/123685.jpg', width: 1440, height: 850, focus: '50% 55%', alt: "Glowing lava in Onyxia's Lair" },
  zone2437: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/318577.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'Glowing lava in Ragefire Chasm' },
  zone2557: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/305029.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'Overgrown ruins with a red banner at Dire Maul' },
  zone2597: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/952515.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'Snowy pines and mountains in Alterac Valley' },
  zone2677: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/114447.jpg', width: 1169, height: 730, focus: '50% 55%', alt: 'Ruined pillars in Blackwing Lair' },
  zone2717: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/81144.jpg', width: 1024, height: 768, focus: '50% 50%', alt: 'Lava flows in Molten Core' },
  zone3277: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/828019.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'A glowing forest of purple blossoms in Warsong Gulch' },
  zone3358: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/448765.jpg', width: 1366, height: 768, focus: '50% 55%', alt: 'Mountains under a turquoise sky at Arathi Basin' },
  zone3428: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/804185.jpg', width: 1841, height: 1009, focus: '50% 55%', alt: "Carved gold on dark blue stone at Ahn'Qiraj" },
  zone3429: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/65411.jpg', width: 1440, height: 900, focus: '50% 55%', alt: "Sandstone ruins at the Ruins of Ahn'Qiraj" },
  zone3456: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/410225.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'A slime fall in the grey halls of Naxxramas' },
  zone15475: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/176216.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Dark masts and a tower against a teal sky in Ashenvale' },
  zone15531: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179191.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Wooden houses on a dark shore in the Blasted Lands' },
  zone15532: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179128.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Grey sea cliffs in Azshara' },
  zone15809: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179156.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A dark green forest in Felwood' },
  zone15825: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/264003.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'A ruined tower at sunset in Silithus' },
  zone15828: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175187.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Dark ruins in a green mist in the Western Plaguelands' },
  zone15938: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1118067.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A snowy path between pines in Winterspring' },
  zone16003: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179121.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Red autumn trees around a domed ruin in Azshara' },
  zone16004: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179163.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Night elf buildings glowing blue in a forest on Mount Hyjal' },
  zone16017: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/176231.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Sunset over the sea off the coast of Desolace' },
  zone16018: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/176240.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A stream and shafts of light in a dark forest in Feralas' },
  zone16028: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/225450.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A gate between two towers in orange haze in the Eastern Plaguelands' },
  zone16029: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/248193.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Pines in a misty valley in the Hinterlands' },
  zone16074: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175259.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'Rain falling on the tower of Karazhan' },
  zone16076: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/149669.jpg', width: 1152, height: 864, focus: '50% 50%', alt: "Purple stone and glowing orbs in the Temple of Ahn'Qiraj" },
  zone16113: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179249.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Lakeside houses among trees in the Redridge Mountains' },
  zone16114: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1099386.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A dead tree among blue rocks in Deadwind Pass' },
  zone16115: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179185.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A wrecked ship on red ground in the Blasted Lands' },
  zone16116: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/477483.jpg', width: 1776, height: 999, focus: '50% 55%', alt: 'A mossy temple in the Swamp of Sorrows' },
  zone16117: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1240726.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A green jungle canopy in Stranglethorn Vale' },
  zone16118: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/293206.jpg', width: 1920, height: 1138, focus: '50% 55%', alt: 'Golden trees on a green hill in Elwynn Forest' },
  zone16119: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1099382.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Rain on a cottage in the dark Duskwood' },
  zone16147: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175168.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A lake and oak trees at sunset in Elwynn Forest' },
  zone16148: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/657647.jpg', width: 1912, height: 1069, focus: '50% 55%', alt: 'The Twilight Grove seen from above in Duskwood' },
  zone16149: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1263981.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A hazy meadow with a lone tree in Westfall' },
  zone16169: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/2851.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A ruined temple in teal light in Ashenvale' },
  zone16236: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/177471.jpg', width: 1366, height: 768, focus: '50% 55%', alt: 'Dark trees under a red sky at the Scarlet Enclave' },
  zone16295: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/337061.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'A setting sun over rock spires in Silithus' },
  zone16362: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179157.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Lanterns along a wooden wall in Felwood' },
  zone16394: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/120973.jpg', width: 1604, height: 899, focus: '50% 55%', alt: 'Purple stone halls in Naxxramas' },
  zone16508: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1290523.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A volcanic peak glowing red in the Burning Steppes' },
  zone16509: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1291794.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A great oak and misty towers in Stormwind' },
  zone16510: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/175163.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'Oaks in a forest clearing in Elwynn Forest' },
  zone16560: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/101782.jpg', width: 1680, height: 1050, focus: '50% 50%', alt: 'The violet roofs and spires of Dalaran' },
  zone16562: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/179235.jpg', width: 1920, height: 1200, focus: '50% 55%', alt: 'A large farmhouse among forest trees in Hillsbrad Foothills' },
  zone16603: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/78268.jpg', width: 1440, height: 844, focus: '50% 55%', alt: 'Huts and a long wall on a sunlit hill in Warsong Gulch' },
  zone16606: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1241723.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Red rock formations at sunset in Durotar' },
  zone16611: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/286811.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'Ruined towers under a pale moon in Lordaeron' },
  zone16653: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1264041.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'Grey rocky hills in Gilneas' },
  zone16732: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/174302.jpg', width: 1680, height: 1050, focus: '50% 55%', alt: 'A stone gateway under a purple dusk sky in the Wetlands' },
  zone16756: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1264031.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A misty city skyline in Gilneas' },
  zone16876: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/163476.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'A wooden dig platform on a green hill in the Wetlands' },
  zone16919: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/370940.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'The icy stone face of Ironforge' },
  zone17065: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1264010.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A misty tower in Gilneas' },
  zone17191: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/1264035.jpg', width: 1600, height: 900, focus: '50% 55%', alt: 'A manor and church spire in the mist in Gilneas' },
  zone17803: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/184707.jpg', width: 1837, height: 1200, focus: '50% 55%', alt: 'Lava-lit stone halls in Blackrock Depths' },
  zone17804: { src: 'https://wow.zamimg.com/uploads/screenshots/normal/501293.jpg', width: 1920, height: 1080, focus: '50% 55%', alt: 'A volcanic peak under a red sky at Blackrock Mountain' },
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

/** The picture for each zone, by the zone ids in data/zones.json. Every zone has one. */
export const ZONE_ART: Record<number, ArtKey> = {
  1: 'zone1', // Dun Morogh
  3: 'zone3', // Badlands
  4: 'zone4', // Blasted Lands
  8: 'zone8', // Swamp of Sorrows
  10: 'zone10', // Duskwood
  11: 'zone11', // Wetlands
  12: 'zone12', // Elwynn Forest
  14: 'zone14', // Durotar
  15: 'dustwallow', // Dustwallow Marsh
  16: 'zone16', // Azshara
  17: 'barrens', // The Barrens
  25: 'zone25', // Blackrock Mountain
  28: 'zone28', // Western Plaguelands
  33: 'zone33', // Stranglethorn Vale
  36: 'zone36', // Alterac Mountains
  38: 'zone38', // Loch Modan
  40: 'zone40', // Westfall
  41: 'zone41', // Deadwind Pass
  44: 'zone44', // Redridge Mountains
  45: 'zone45', // Arathi Highlands
  46: 'zone46', // Burning Steppes
  47: 'zone47', // The Hinterlands
  51: 'zone51', // Searing Gorge
  85: 'zone85', // Tirisfal Glades
  130: 'zone130', // Silverpine Forest
  139: 'zone139', // Eastern Plaguelands
  141: 'rulesets', // Teldrassil
  148: 'darkshore', // Darkshore
  209: 'zone209', // Shadowfang Keep
  215: 'mulgore', // Mulgore
  267: 'zone267', // Hillsbrad Foothills
  331: 'ashenvale', // Ashenvale
  357: 'zone357', // Feralas
  361: 'felwood', // Felwood
  400: 'zone400', // Thousand Needles
  405: 'zone405', // Desolace
  406: 'zone406', // Stonetalon Mountains
  440: 'zone440', // Tanaris
  490: 'zone490', // Un'Goro Crater
  491: 'zone491', // Razorfen Kraul
  493: 'zone493', // Moonglade
  616: 'zone616', // Mount Hyjal
  618: 'zone618', // Winterspring
  717: 'zone717', // The Stockade
  718: 'zone718', // Wailing Caverns
  719: 'zone719', // Blackfathom Deeps
  721: 'zone721', // Gnomeregan
  722: 'zone722', // Razorfen Downs
  796: 'zone796', // Scarlet Monastery
  1176: 'zone1176', // Zul'Farrak
  1337: 'zone1337', // Uldaman
  1377: 'zone1377', // Silithus
  1397: 'zone1397', // Emerald Forest
  1417: 'zone1417', // Sunken Temple
  1477: 'zone1477', // The Temple of Atal'Hakkar
  1497: 'zone1497', // Undercity
  1519: 'zone1519', // Stormwind City
  1537: 'zone1537', // Ironforge
  1581: 'zone1581', // The Deadmines
  1583: 'zone1583', // Blackrock Spire
  1584: 'zone1584', // Blackrock Depths
  1637: 'zone1637', // Orgrimmar
  1638: 'zone1638', // Thunder Bluff
  1657: 'zone1657', // Darnassus
  1941: 'zone1941', // Caverns of Time
  1977: 'zone1977', // Zul'Gurub
  2017: 'zone2017', // Stratholme
  2057: 'zone2057', // Scholomance
  2100: 'zone2100', // Maraudon
  2159: 'zone2159', // Onyxia's Lair
  2437: 'zone2437', // Ragefire Chasm
  2557: 'zone2557', // Dire Maul
  2597: 'zone2597', // Alterac Valley
  2677: 'zone2677', // Blackwing Lair
  2717: 'zone2717', // Molten Core
  3277: 'zone3277', // Warsong Gulch
  3358: 'zone3358', // Arathi Basin
  3428: 'zone3428', // Ahn'Qiraj
  3429: 'zone3429', // Ruins of Ahn'Qiraj
  3456: 'zone3456', // Naxxramas
  15475: 'zone15475', // Demon Fall Canyon
  15531: 'zone15531', // The Tainted Scar
  15532: 'zone15532', // Storm Cliffs
  15809: 'zone15809', // Felwood
  15825: 'zone15825', // The Crystal Vale
  15828: 'zone15828', // The Burning of Andorhal
  15938: 'zone15938', // Starfall Village
  16003: 'zone16003', // Azshara
  16004: 'zone16004', // Mount Hyjal
  16017: 'zone16017', // Desolace
  16018: 'zone16018', // Feralas
  16028: 'zone16028', // Eastern Plaguelands
  16029: 'zone16029', // The Hinterlands
  16074: 'zone16074', // Karazhan Crypts
  16076: 'zone16076', // Temple of Ahn'Qiraj
  16113: 'zone16113', // Redridge Mountains
  16114: 'zone16114', // Deadwind Pass
  16115: 'zone16115', // Blasted Lands
  16116: 'zone16116', // Swamp of Sorrows
  16117: 'zone16117', // Stranglethorn Vale
  16118: 'zone16118', // Elwynn Forest
  16119: 'zone16119', // Duskwood
  16147: 'zone16147', // Elwynn Forest
  16148: 'zone16148', // Duskwood
  16149: 'zone16149', // Westfall
  16169: 'zone16169', // Ashenvale
  16236: 'zone16236', // Scarlet Enclave
  16295: 'zone16295', // The Scarab Dais
  16362: 'zone16362', // Shadow Hold
  16394: 'zone16394', // Naxxramas
  16508: 'zone16508', // Burning Steppes
  16509: 'zone16509', // Stormwind City
  16510: 'zone16510', // Elwynn Forest
  16544: 'dalaranNight', // City of Dalaran
  16560: 'zone16560', // City of Dalaran
  16562: 'zone16562', // Hillsbrad Foothills
  16591: 'paintedVista', // Riverglades
  16593: 'zephras', // Zephras Isle
  16603: 'zone16603', // Warsong Gulch
  16606: 'zone16606', // Darkspear Islands
  16611: 'zone16611', // Ruins of Lordaeron
  16651: 'untoldStories', // Shen'dralas
  16653: 'zone16653', // Battle for Gilneas
  16732: 'zone16732', // Excavation Site: Wetlands
  16756: 'zone16756', // Ruins of Gilneas
  16876: 'zone16876', // Whelgar's Excavation Site
  16919: 'zone16919', // The Hall of Thanes
  17065: 'zone17065', // Gilneas
  17191: 'zone17191', // Manor Mistmantle
  17803: 'zone17803', // Blackrock Depths
  17804: 'zone17804', // Blackrock Spire
};

export const SECTION_ART: Record<string, ArtKey> = {
  home: 'homeBackground',
  talents: 'expanses',
  classes: 'newPower',
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
