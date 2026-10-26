// Sample datasets for each tool. The numbers are made up for classroom practice.
// To add your own, copy an entry and change the values.

export const oneVarSamples = [
  {
    title: 'Quiz scores (one class)',
    name: 'quiz score',
    units: 'points',
    groups: [{ name: '', values: '72 85 90 64 88 95 78 81 70 92 85 77 83 69 91 87 74 80 98 55 86 79 84 90' }],
  },
  {
    title: 'Text messages sent yesterday (skewed right)',
    name: 'number of texts sent',
    units: 'texts',
    groups: [{ name: '', values: '12 25 8 40 15 3 60 22 18 9 110 30 14 5 27 45 19 11 35 7 16 24 85 20 13' }],
  },
  {
    title: 'Hours of sleep last night',
    name: 'hours of sleep',
    units: 'hours',
    groups: [{ name: '', values: '7 6.5 8 5 7.5 6 9 7 6.5 8 7 5.5 6 7.5 8.5 7 6 4.5 7 8 6.5 7 7.5 6' }],
  },
  {
    title: 'Geyser wait times (bimodal)',
    name: 'wait time between eruptions',
    units: 'minutes',
    groups: [{ name: '', values: '54 55 52 57 50 56 53 49 58 55 51 54 78 82 80 85 79 76 83 81 88 77 84 80 86 79 82 75 90 81' }],
  },
  {
    title: 'Compare: Reaction time, dominant vs. other hand',
    name: 'reaction time',
    units: 'ms',
    groups: [
      { name: 'Dominant', values: '245 260 238 252 270 241 255 263 249 236 258 244 266 251 240' },
      { name: 'Non-dominant', values: '268 281 259 290 275 262 300 271 284 266 279 288 263 296 274' },
    ],
  },
  {
    title: 'Compare: Points per game, two players',
    name: 'points per game',
    units: 'points',
    groups: [
      { name: 'Player A', values: '18 22 15 20 19 24 17 21 16 23 20 19' },
      { name: 'Player B', values: '8 31 12 27 5 35 20 14 29 10 33 16' },
    ],
  },
];

export const twoVarSamples = [
  {
    title: 'Hours studied vs. test score',
    xName: 'hours studied',
    yName: 'test score',
    x: '0.5 1 1 1.5 2 2 2.5 3 3 3.5 4 4.5 5 5.5 6',
    y: '58 62 65 64 70 68 74 73 79 80 82 85 84 90 93',
  },
  {
    title: 'Arm span vs. height (inches)',
    xName: 'arm span (in)',
    yName: 'height (in)',
    x: '60 62 63 64 65 66 66 67 68 69 70 71 72 74',
    y: '61 61 64 63 66 65 67 68 67 70 69 72 71 73',
  },
  {
    title: 'Car age vs. price (thousands of $)',
    xName: 'age (years)',
    yName: 'price ($1000s)',
    x: '1 2 2 3 4 5 5 6 7 8 9 10 11 12',
    y: '28 25 26 22 20 17 18 15 13 12 10 9 7 6',
  },
  {
    title: 'Temperature vs. hot chocolate sales (curved)',
    xName: 'temperature (°F)',
    yName: 'cups sold',
    x: '20 25 30 35 40 45 50 55 60 65 70 75 80',
    y: '95 84 72 62 52 44 37 31 27 24 22 21 21',
  },
];

export const categoricalSamples = [
  {
    title: 'Favorite pizza topping',
    name: 'favorite pizza topping',
    counts: 'Pepperoni, 14\nCheese, 9\nSausage, 5\nVeggie, 3\nPineapple, 4',
  },
  {
    title: 'How students get to school',
    name: 'way of getting to school',
    counts: 'Car, 42\nBus, 31\nWalk, 9\nBike, 4\nOther, 2',
  },
];

export const twoWaySamples = [
  {
    title: 'Grade level vs. preferred social app',
    rowName: 'grade level',
    colName: 'preferred app',
    rows: ['9th', '10th', '11th', '12th'],
    cols: ['TikTok', 'Instagram', 'Snapchat'],
    counts: [[30, 12, 18], [25, 16, 19], [18, 22, 20], [14, 26, 21]],
  },
  {
    title: 'Sports participation vs. part-time job',
    rowName: 'plays a sport',
    colName: 'has a job',
    rows: ['Plays a sport', 'No sport'],
    cols: ['Job', 'No job'],
    counts: [[18, 62], [41, 59]],
  },
];

export const simulationSamples = [
  {
    title: 'Can they taste the difference? (16 of 20 correct)',
    mode: 'one-prop',
    p0: 0.5,
    n: 20,
    observed: 16,
    direction: 'greater',
    success: 'correct guesses',
  },
  {
    title: 'Is the coin fair? (38 heads in 100 flips)',
    mode: 'one-prop',
    p0: 0.5,
    n: 100,
    observed: 38,
    direction: 'two',
    success: 'heads',
  },
  {
    title: 'Does music help memory? (words remembered)',
    mode: 'diff-means',
    measure: 'words remembered',
    aName: 'Music',
    bName: 'Silence',
    a: '12 15 9 14 11 13 16 10 12 14',
    b: '10 8 11 9 12 7 10 9 11 8',
    direction: 'greater',
  },
  {
    title: 'Is yawning contagious? (10 of 34 vs. 4 of 16)',
    mode: 'diff-props',
    aName: 'Saw a yawn',
    bName: 'No yawn',
    aSuccess: 10,
    aSize: 34,
    bSuccess: 4,
    bSize: 16,
    success: 'yawned',
    direction: 'greater',
  },
];
