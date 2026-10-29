/**
 * The leveling route used by the leveling guide and the leveling tool: questing zones per faction for each
 * level band. Zone ids match /world/<id>. Bands overlap on purpose, as zones do in the game.
 */
export interface RouteBand {
  lo: number;
  hi: number;
  alliance: number[];
  horde: number[];
  note: string;
}

export const ROUTE: RouteBand[] = [
  { lo: 1, hi: 12, alliance: [12, 1, 141, 16593], horde: [14, 215, 85, 16593], note: 'Your race’s starting zone. The Skyborne of both factions start on Zephras Isle, which runs to 12.' },
  { lo: 10, hi: 20, alliance: [40, 38, 148, 44], horde: [17, 130], note: 'The first two new dungeons open here: The Hall of Thanes from 13 and Ruins of Lordaeron from 15.' },
  { lo: 20, hi: 30, alliance: [10, 11, 331, 267], horde: [406, 331, 267, 400], note: 'Whelgar’s Excavation in the Wetlands and the City of Dalaran in Alterac fill the late 20s. Your first Legacy point usually lands at 25.' },
  { lo: 30, hi: 40, alliance: [45, 33, 405, 36], horde: [45, 33, 405, 400], note: 'Stranglethorn Vale carries both factions; The Drowned City sits off its coast from 35.' },
  { lo: 36, hi: 45, alliance: [16591, 16651, 15, 8, 3], horde: [16591, 16651, 15, 8, 3], note: 'Two new zones should fill the old gap: Riverglades, home of the outdoor Krol’dok Stronghold (40 to 45), and Shen’dralas. Blizzard has not announced their level ranges yet.' },
  { lo: 45, hi: 52, alliance: [440, 357, 47, 16, 51], horde: [440, 357, 47, 16, 51], note: 'Tanaris, Feralas and The Hinterlands lead toward the endgame. Alcaz Prison opens at 48.' },
  { lo: 52, hi: 58, alliance: [490, 361, 28, 46], horde: [490, 361, 28, 46], note: 'Un’Goro Crater, Felwood and the Plaguelands, with Blackrock Depths and Stratholme for groups.' },
  { lo: 55, hi: 60, alliance: [616, 618, 139, 1377], horde: [616, 618, 139, 1377], note: 'Mount Hyjal is the new endgame zone, home to Hyjal Summit and an entrance to the Barrow Deeps.' },
];

export function bandsFor(level: number) {
  return ROUTE.filter((b) => level >= b.lo && level <= b.hi);
}
