import { stageAt } from '@shared/course'

import { COURSE } from './course'

/**
 * The stages down each world's slide, by turns (course.js stageAt): each with its own
 * name, wall and lane colours, gate, lamps, scenery on the banks (slideChunk.js) and, for some,
 * cliffs. Small and separate so the HUD can name the stage you're in without pulling
 * in the slide's builder.
 */
const STAGES = {
  snowy: [
    { name: 'Pine Valley', wall: '#7cc4f8', lane: '#a6d4fa', gate: ['#56678c', '#4d5d80'], lamp: '#fff2a8', decor: 'pine' },
    { name: 'Crystal Caves', wall: '#6fd0ee', lane: '#b2f1ff', gate: ['#7fd8f5', '#5fc0e8'], lamp: '#9ef0ff', decor: 'crystal', cliff: ['#6f8fb5', '#7d9cc0', '#5f80a8'] },
    { name: 'Candy Lane', wall: '#ff9ccf', lane: '#ffc6ec', gate: ['#ff6fb5', '#ffffff'], lamp: '#ffb3e6', decor: 'candy' },
    { name: 'Cosy Village', wall: '#7fb8e8', lane: '#ffe3a3', gate: ['#a8672e', '#8a5226'], lamp: '#ffd27a', decor: 'village' },
    { name: 'Aurora Peaks', wall: '#8f7cf0', lane: '#c9b3ff', gate: ['#3a2f7a', '#4a3d99'], lamp: '#b6ffdf', decor: 'aurora', cliff: ['#4a4f7a', '#565c8a', '#3f4470'] },
  ],
  gold: [
    { name: 'Cactus Canyon', wall: '#e8913a', lane: '#ffb84a', gate: ['#c9733a', '#b8652f'], lamp: '#fff2a8', decor: 'pine' },
    { name: 'Lost Ruins', wall: '#d9a066', lane: '#ffd27a', gate: ['#e2c48a', '#cfae6e'], lamp: '#ffe9a8', decor: 'ruins' },
    { name: 'Palm Oasis', wall: '#4fc3b0', lane: '#7fe3d0', gate: ['#3faa4a', '#2f9a40'], lamp: '#bfffe8', decor: 'palm' },
    { name: 'Gold Mine', wall: '#b8843a', lane: '#ffe36b', gate: ['#6a3a1a', '#8a5226'], lamp: '#ffd23a', decor: 'mine', cliff: ['#7a5a3a', '#6a4a2a', '#8a6a4a'] },
    { name: 'Pyramid Dunes', wall: '#e0a85a', lane: '#f2c27a', gate: ['#d9a066', '#c98f5a'], lamp: '#fff2a8', decor: 'pyramid' },
  ],
  lava: [
    { name: 'Ember Fields', wall: '#7a3a3a', lane: '#ff8a3a', gate: ['#3a2a2a', '#4a3030'], lamp: '#ffb040', decor: 'pine' },
    { name: 'Obsidian Spires', wall: '#5a4a7a', lane: '#c070ff', gate: ['#2a2238', '#3a2f4a'], lamp: '#d9a0ff', decor: 'aurora' },
    { name: 'Magma Falls', wall: '#a8432a', lane: '#ffb02e', gate: ['#5a2a1a', '#6a3020'], lamp: '#ff7a1a', decor: 'magma' },
    { name: 'Crystal Core', wall: '#3a6a8a', lane: '#5fe0ff', gate: ['#2a4a6a', '#3a5a7a'], lamp: '#7fe8ff', decor: 'crystal', cliff: ['#3a4a5a', '#2e3a4a', '#465a6a'] },
    { name: "Dragon's Lair", wall: '#6a2a3a', lane: '#ff5a5a', gate: ['#3a1a20', '#4a2028'], lamp: '#ff4a4a', decor: 'mine' },
  ],
}

/** The stage metre s is in: its name and look. */
export function stageTheme(s) {
  const list = STAGES[COURSE.world.id] ?? STAGES.snowy
  return list[stageAt(s) % list.length]
}
