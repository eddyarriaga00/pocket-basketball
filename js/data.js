/* PocketBasketball: league data, names, ratings helpers. Classic script, exposes window.PB.
   Every team and player is fictional. The cities are the real league's cities; the nicknames and colors are this
   game's own (real league and team names are trademarks). */
(() => {
  'use strict';
  const PB = window.PB = window.PB || {};

  /* Seeded random: PB.seed(n) makes a run repeatable for tests; seed(0) goes back to Math.random. */
  let SEEDED = false, S = 0;
  PB.rand = () => {
    if (!SEEDED) return Math.random();
    S = (S + 0x6D2B79F5) | 0;
    let t = Math.imul(S ^ S >>> 15, 1 | S);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  PB.seed = n => { SEEDED = !!n; S = n | 0; };
  PB.rr = (a, b) => a + PB.rand() * (b - a);
  PB.ri = (a, b) => Math.floor(PB.rr(a, b + 1));
  PB.pick = a => a[Math.floor(PB.rand() * a.length)];
  PB.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  PB.gauss = () => { let u = 0, v = 0; while (!u) u = PB.rand(); while (!v) v = PB.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v); };

  /* 30 teams, two conferences of three divisions, aligned the way the real league is by city. */
  PB.TEAMS = [
    // East · Atlantic
    { id: 'BOS', city: 'Boston', name: 'Brahmins', c1: '#0f5b3a', c2: '#e8d9a8', conf: 'East', div: 'Atlantic' },
    { id: 'BKN', city: 'Brooklyn', name: 'Bridges', c1: '#1c1c1c', c2: '#c9ccd1', conf: 'East', div: 'Atlantic' },
    { id: 'NY', city: 'New York', name: 'Empire', c1: '#1b3f8f', c2: '#f28a1e', conf: 'East', div: 'Atlantic' },
    { id: 'PHI', city: 'Philadelphia', name: 'Liberty', c1: '#0b4fa8', c2: '#d7263d', conf: 'East', div: 'Atlantic' },
    { id: 'TOR', city: 'Toronto', name: 'Moose', c1: '#7a1424', c2: '#c4c6c8', conf: 'East', div: 'Atlantic' },
    // East · Central
    { id: 'CHI', city: 'Chicago', name: 'Wind', c1: '#a3122a', c2: '#111111', conf: 'East', div: 'Central' },
    { id: 'CLE', city: 'Cleveland', name: 'Ironmen', c1: '#5a1f2e', c2: '#d6a840', conf: 'East', div: 'Central' },
    { id: 'DET', city: 'Detroit', name: 'Motors', c1: '#1d4e9e', c2: '#c8102e', conf: 'East', div: 'Central' },
    { id: 'IND', city: 'Indianapolis', name: 'Speed', c1: '#0c2340', c2: '#f5b400', conf: 'East', div: 'Central' },
    { id: 'MIL', city: 'Milwaukee', name: 'Frost', c1: '#1f4d3c', c2: '#bfe3ef', conf: 'East', div: 'Central' },
    // East · Southeast
    { id: 'ATL', city: 'Atlanta', name: 'Peaches', c1: '#e8573a', c2: '#2d2a4a', conf: 'East', div: 'Southeast' },
    { id: 'CHA', city: 'Charlotte', name: 'Monarchs', c1: '#3f2a7a', c2: '#2ec4b6', conf: 'East', div: 'Southeast' },
    { id: 'MIA', city: 'Miami', name: 'Flamingos', c1: '#f25c9a', c2: '#14213d', conf: 'East', div: 'Southeast' },
    { id: 'ORL', city: 'Orlando', name: 'Comets', c1: '#1572c2', c2: '#a9b4c2', conf: 'East', div: 'Southeast' },
    { id: 'WAS', city: 'Washington', name: 'Monuments', c1: '#12284b', c2: '#e31837', conf: 'East', div: 'Southeast' },
    // West · Northwest
    { id: 'DEN', city: 'Denver', name: 'Summit', c1: '#0e2240', c2: '#fec524', conf: 'West', div: 'Northwest' },
    { id: 'MIN', city: 'Minneapolis', name: 'Loons', c1: '#0b2a2f', c2: '#78be20', conf: 'West', div: 'Northwest' },
    { id: 'OKC', city: 'Oklahoma City', name: 'Twisters', c1: '#2f6fb3', c2: '#ef6c35', conf: 'West', div: 'Northwest' },
    { id: 'POR', city: 'Portland', name: 'Pines', c1: '#173d2a', c2: '#e1e1d6', conf: 'West', div: 'Northwest' },
    { id: 'SLC', city: 'Salt Lake', name: 'Peaks', c1: '#3b2b6b', c2: '#9ad3f0', conf: 'West', div: 'Northwest' },
    // West · Pacific
    { id: 'SF', city: 'San Francisco', name: 'Fog', c1: '#3d4b5c', c2: '#ffb81c', conf: 'West', div: 'Pacific' },
    { id: 'LAW', city: 'Los Angeles', name: 'Waves', c1: '#00788c', c2: '#f9d342', conf: 'West', div: 'Pacific' },
    { id: 'LAK', city: 'Los Angeles', name: 'Knights', c1: '#232323', c2: '#c9a227', conf: 'West', div: 'Pacific' },
    { id: 'PHX', city: 'Phoenix', name: 'Scorpions', c1: '#b5421b', c2: '#2b1d14', conf: 'West', div: 'Pacific' },
    { id: 'SAC', city: 'Sacramento', name: 'Gold', c1: '#c99700', c2: '#3a2a5e', conf: 'West', div: 'Pacific' },
    // West · Southwest
    { id: 'DAL', city: 'Dallas', name: 'Wranglers', c1: '#0050b5', c2: '#bfc5cc', conf: 'West', div: 'Southwest' },
    { id: 'HOU', city: 'Houston', name: 'Orbit', c1: '#c4122f', c2: '#f2f2f2', conf: 'West', div: 'Southwest' },
    { id: 'MEM', city: 'Memphis', name: 'Blues', c1: '#5d76a9', c2: '#12173f', conf: 'West', div: 'Southwest' },
    { id: 'NO', city: 'New Orleans', name: 'Krewe', c1: '#4b2a7b', c2: '#2e9b5f', conf: 'West', div: 'Southwest' },
    { id: 'SA', city: 'San Antonio', name: 'Rattlers', c1: '#6b6b6b', c2: '#e04e39', conf: 'West', div: 'Southwest' },
  ];
  /* Edit teams: renames and colors kept on this device (the id never changes, so saves keep working) */
  PB.TEAM_DEFAULTS = PB.TEAMS.map(t => ({ ...t }));
  PB.applyTeamEdits = () => {
    let ed = {}; try { ed = JSON.parse(localStorage.getItem('pbb.teams') || '{}'); } catch (e) { ed = {}; }
    PB.TEAMS.forEach((t, i) => { Object.assign(t, PB.TEAM_DEFAULTS[i], ed[t.id] || {}); t.ab = (t.ab || t.id).toUpperCase().slice(0, 4); });
  };
  PB.applyTeamEdits();
  PB.team = id => PB.TEAMS.find(t => t.id === id);

  /* Names: each player comes from somewhere, and his first name, last name, hometown and look come from the same place,
     so a roster reads like people (no "Nikola Okafor"). The real league is about three quarters American. skin: weights
     over PB.SKIN's six tones. */
  PB.ORIGINS = [
    { id: 'us', w: 70, skin: [1, 1, 1.4, 2, 2.4, 2],
      first: ['Marcus', 'Jalen', 'Tyrese', 'Darius', 'Andre', 'Caleb', 'Malik', 'Jordan', 'Isaiah', 'Devin', 'Trey', 'Xavier',
        'Elijah', 'Cameron', 'Miles', 'Jaylen', 'Kendrick', 'Rashad', 'Damon', 'Quentin', 'Brandon', 'Tobias', 'Amari',
        'Dominic', 'Zion', 'Omar', 'Jamal', 'Keon', 'Lonnie', 'Nate', 'Reggie', 'Tariq', 'Wes', 'Aaron', 'Bryce', 'Corey',
        'Desmond', 'Grant', 'Javon', 'Kris', 'Lamar', 'Noah', 'Terrence', 'Vince', 'DeShawn', 'Tyler', 'Cody', 'Logan',
        'Austin', 'Colby', 'Dalton', 'Jaxon', 'Kyrell', 'Montrez', 'Ty', 'Deandre', 'Cedric', 'Jarvis', 'Khalil', 'Darnell',
        'Treyvon', 'Bryson', 'Ellis', 'Hunter', 'Mason', 'Dante', 'Rodney', 'Kobe', 'Jabari', 'Micah', 'Silas', 'Ronnie'],
      last: ['Walker', 'Brooks', 'Hayes', 'Coleman', 'Bennett', 'Mitchell', 'Ward', 'Price', 'Holloway', 'Pierce', 'Rhodes',
        'Whitfield', 'Barnes', 'Ellison', 'Ford', 'Gibson', 'Harmon', 'Jefferson', 'Maddox', 'Quinn', 'Rowe', 'Tucker',
        'Underwood', 'Vance', 'Whitley', 'Booker', 'Crane', 'Easton', 'Farrow', 'Greer', 'Hollins', 'Jessup', 'Larkin',
        'Pruitt', 'Rollins', 'Thornton', 'Wexler', 'Yates', 'Calloway', 'Dorsey', 'Fairley', 'Hargrove', 'Kimbrough',
        'Lockhart', 'Merritt', 'Pennington', 'Redmond', 'Sterling', 'Upshaw', 'Vickers', 'Abernathy', 'Blackwood',
        'Emerson', 'Gaines', 'Hightower', 'Montague', 'Prescott', 'Hollis', 'Jarrett', 'Mabry', 'Pickett', 'Sullivan',
        'Kowalski', 'Bellamy', 'Ashby', 'Dunleavy', 'Langston', 'Mayfield', 'Odom', 'Pettaway', 'Ransom', 'Shelton',
        'Toliver', 'Wardell', 'Battle', 'Councill', 'Dukes', 'Frierson', 'Goodwin', 'Hairston', 'Lattimore', 'McCray'],
      from: ['Houston, TX', 'Atlanta, GA', 'Chicago, IL', 'Baltimore, MD', 'Philadelphia, PA', 'Queens, NY', 'Brooklyn, NY',
        'Oakland, CA', 'Compton, CA', 'Seattle, WA', 'Indianapolis, IN', 'Memphis, TN', 'Dallas, TX', 'Detroit, MI',
        'Flint, MI', 'Raleigh, NC', 'Charlotte, NC', 'New Orleans, LA', 'Akron, OH', 'Louisville, KY', 'Las Vegas, NV',
        'Phoenix, AZ', 'Milwaukee, WI', 'St. Louis, MO', 'Newark, NJ', 'Richmond, VA', 'Birmingham, AL', 'Jackson, MS',
        'Omaha, NE', 'Salt Lake City, UT', 'Portland, OR', 'Minneapolis, MN', 'Kansas City, MO', 'Little Rock, AR', 'Miami, FL'] },
    { id: 'ng', w: 4, skin: [0, 0, 0, 0.3, 1.5, 3],
      first: ['Chidi', 'Obinna', 'Tobenna', 'Ikenna', 'Uche', 'Femi', 'Tunde', 'Kelechi', 'Chinedu', 'Ifeanyi', 'Olu', 'Emeka', 'Daniel', 'Victor'],
      last: ['Okafor', 'Nwosu', 'Ugwu', 'Okonkwo', 'Adeyemi', 'Oduya', 'Eze', 'Nnamdi', 'Okeke', 'Uzoma', 'Afolabi', 'Abara', 'Onuoha', 'Achebe'],
      from: ['Lagos, Nigeria', 'Abuja, Nigeria', 'Enugu, Nigeria', 'Ibadan, Nigeria', 'Port Harcourt, Nigeria'] },
    { id: 'sn', w: 3, skin: [0, 0, 0, 0, 1, 3],
      first: ['Sekou', 'Mamadou', 'Cheikh', 'Ousmane', 'Ibrahima', 'Moussa', 'Abdoulaye', 'Pape', 'Babacar', 'Lamine'],
      last: ['Ndiaye', 'Sow', 'Fall', 'Diop', 'Gueye', 'Faye', 'Kane', 'Seck', 'Mbaye', 'Cisse', 'Diallo'],
      from: ['Dakar, Senegal', 'Thiès, Senegal', 'Bamako, Mali', 'Conakry, Guinea'] },
    { id: 'rs', w: 4, skin: [3, 1, 0, 0, 0, 0],
      first: ['Nikola', 'Marko', 'Stefan', 'Vasilije', 'Dusan', 'Filip', 'Aleksa', 'Nemanja', 'Uros', 'Mihajlo', 'Vuk', 'Lazar'],
      last: ['Markovic', 'Radovic', 'Kostic', 'Ilic', 'Pavlovic', 'Savic', 'Stojanovic', 'Vukovic', 'Lazic', 'Tomic', 'Petrovic', 'Novak', 'Babic'],
      from: ['Belgrade, Serbia', 'Novi Sad, Serbia', 'Niš, Serbia', 'Zagreb, Croatia', 'Split, Croatia', 'Podgorica, Montenegro', 'Ljubljana, Slovenia'] },
    { id: 'lt', w: 2, skin: [3, 1, 0, 0, 0, 0],
      first: ['Mindaugas', 'Tadas', 'Rokas', 'Arnas', 'Deividas', 'Lukas', 'Martynas', 'Kristaps', 'Rihards'],
      last: ['Kazlauskas', 'Petrauskas', 'Jankauskas', 'Butkus', 'Stankevicius', 'Navickas', 'Paulauskas', 'Urbonas', 'Ozolins', 'Berzins'],
      from: ['Kaunas, Lithuania', 'Vilnius, Lithuania', 'Klaipėda, Lithuania', 'Riga, Latvia'] },
    { id: 'fr', w: 4, skin: [1.5, 1, 0.6, 0.6, 1, 1.4],
      first: ['Theo', 'Mathis', 'Hugo', 'Killian', 'Bastien', 'Yann', 'Nicolas', 'Axel', 'Ludovic', 'Mathieu', 'Elie', 'Noa'],
      last: ['Moreau', 'Fontaine', 'Delacroix', 'Duquesne', 'Lefebvre', 'Girard', 'Rousseau', 'Mercier', 'Lambert', 'Chevalier', 'Bonnet', 'Baptiste', 'Fabre'],
      from: ['Paris, France', 'Lyon, France', 'Le Mans, France', 'Villeurbanne, France', 'Pau, France', 'Montreal, Canada', 'Brussels, Belgium'] },
    { id: 'es', w: 4, skin: [0.6, 1.4, 1.6, 0.8, 0.2, 0],
      first: ['Mateo', 'Diego', 'Santiago', 'Javier', 'Pablo', 'Alejandro', 'Andrés', 'Carlos', 'Tomás', 'Joaquín', 'Facundo', 'Iker', 'Gael'],
      last: ['Reyes', 'Vasquez', 'Castillo', 'Ortega', 'Valdez', 'Zamora', 'Moreno', 'Saldaña', 'Galván', 'Navarro', 'Herrera', 'Cabrera', 'Fuentes', 'Medina'],
      from: ['Madrid, Spain', 'Barcelona, Spain', 'Málaga, Spain', 'Buenos Aires, Argentina', 'Bahía Blanca, Argentina', 'San Juan, Puerto Rico', 'Santo Domingo, D.R.', 'Monterrey, Mexico'] },
    { id: 'br', w: 2, skin: [0.4, 1, 1.4, 1.2, 1, 0.6],
      first: ['Thiago', 'Bruno', 'Rafael', 'Vitor', 'Gui', 'Caio', 'Lucas', 'Matheus'],
      last: ['Ferreira', 'Souza', 'Teixeira', 'Barros', 'Moraes', 'Carvalho', 'Ribeiro', 'Azevedo'],
      from: ['São Paulo, Brazil', 'Rio de Janeiro, Brazil', 'Brasília, Brazil', 'Fortaleza, Brazil'] },
    { id: 'de', w: 3, skin: [3, 1, 0.2, 0, 0, 0],
      first: ['Niklas', 'Lukas', 'Felix', 'Lars', 'Erik', 'Anton', 'Henrik', 'Jonas', 'Mikkel', 'Oskar', 'Tobias'],
      last: ['Brandt', 'Keller', 'Kessler', 'Lindqvist', 'Lindgren', 'Hartmann', 'Becker', 'Vogel', 'Sorensen', 'Halvorsen', 'Brenner', 'Nyberg'],
      from: ['Berlin, Germany', 'Munich, Germany', 'Bamberg, Germany', 'Stockholm, Sweden', 'Oslo, Norway', 'Copenhagen, Denmark', 'Helsinki, Finland'] },
    { id: 'gr', w: 2, skin: [1.4, 1.6, 0.6, 0, 0, 0],
      first: ['Kostas', 'Nikos', 'Dimitris', 'Emre', 'Kerem', 'Cedi', 'Yannis', 'Baris'],
      last: ['Georgiou', 'Alexiou', 'Kaya', 'Yilmaz', 'Demir', 'Aydin', 'Ozturk', 'Kallis', 'Stavrou'],
      from: ['Athens, Greece', 'Thessaloniki, Greece', 'Istanbul, Türkiye', 'Ankara, Türkiye', 'Izmir, Türkiye'] },
    { id: 'au', w: 4, skin: [2.4, 1, 0.3, 0.3, 0.4, 0.4],
      first: ['Liam', 'Jack', 'Riley', 'Mitchell', 'Josh', 'Will', 'Callum', 'Declan', 'Finn', 'Ethan', 'Brodie', 'Kai'],
      last: ['Holloway', 'Kingsley', 'Radcliffe', 'Fenwick', 'Talbot', 'Yardley', 'O’Connell', 'Gallagher', 'Brennan', 'McAllister', 'Sinclair', 'Lennox'],
      from: ['Melbourne, Australia', 'Sydney, Australia', 'Perth, Australia', 'Auckland, New Zealand', 'Toronto, Canada', 'Vancouver, Canada', 'London, England'] },
    { id: 'jp', w: 1, skin: [1.5, 1, 0, 0, 0, 0],
      first: ['Kenta', 'Haruto', 'Yuki', 'Ren', 'Sota', 'Daiki', 'Ryo'],
      last: ['Sato', 'Takeda', 'Morita', 'Kobayashi', 'Ishikawa', 'Fujimoto', 'Okada'],
      from: ['Tokyo, Japan', 'Osaka, Japan', 'Sendai, Japan', 'Fukuoka, Japan'] },
  ];
  PB.FIRST = [...new Set(PB.ORIGINS.flatMap(o => o.first))];
  PB.LAST = [...new Set(PB.ORIGINS.flatMap(o => o.last))];
  /* pairs that belong to real players (or come too close) are never dealt */
  PB.REAL = new Set(['Devin Booker', 'Lonnie Walker', 'Emeka Okafor', 'Marcus Thornton', 'Isaiah Thomas', 'Jordan Walker',
    'Grant Hill', 'Andre Miller', 'Aaron Gordon', 'Moses Brown', 'Caleb Martin', 'Javon Freeman', 'Keon Ellis', 'Jalen Pickett',
    'Aaron Brooks', 'Cheikh Diallo', 'Mamadou Ndiaye', 'Jaxon Hayes', 'Killian Hayes', 'Kris Dunn', 'Lamar Odom', 'Tyler Ward',
    'Marcus Ford', 'Terrence Rhodes', 'Darius Miles', 'Brandon Rowe', 'Jarvis Hayes', 'Cedric Ceballos', 'Khalil Whitney',
    'Zion Williamson', 'Jamal Crawford', 'Corey Brewer', 'Deandre Ayton', 'Jabari Walker', 'Jabari Parker', 'Andre Ward',
    'Darnell Hollis', 'Cody Zeller', 'Tyler Zeller', 'Luka Pavlovic', 'Nikola Pekovic', 'Marko Simonovic', 'Theo Pinson',
    'Bruno Fernando', 'Tomás Satoransky', 'Kai Sotto', 'Josh Booker', 'Ty Ellis', 'Marcus Price', 'Desmond Mason', 'Jordan Hill']);
  const wpick = ws => { let s = ws.reduce((a, b) => a + b, 0), r = PB.rand() * s; for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return i; } return ws.length - 1; };
  PB.origin = id => PB.ORIGINS.find(o => o.id === id) || PB.ORIGINS[0];
  /* a person: {first, last, from, skin, org} drawn from one origin (weighted by how many such players the league has) */
  PB.person = org => {
    const o = org ? PB.origin(org) : PB.ORIGINS[wpick(PB.ORIGINS.map(x => x.w))];
    let first = PB.pick(o.first), last = PB.pick(o.last);
    for (let k = 0; k < 20 && PB.REAL.has(first + ' ' + last); k++) last = PB.pick(o.last);
    return { first, last, from: PB.pick(o.from), skin: wpick(o.skin), org: o.id };
  };

  /* Attributes, 25..99. */
  PB.ATTRS = [
    ['close', 'Close shot', 'Layups and floaters'],
    ['dunk', 'Dunk', 'Finishing above the rim'],
    ['mid', 'Mid-range', 'Pull-ups and elbow jumpers'],
    ['three', 'Three-point', 'Shots from behind the arc'],
    ['ft', 'Free throw', 'At the line'],
    ['handle', 'Ball handle', 'Dribble moves, keeping the ball'],
    ['pass', 'Passing', 'Accuracy, vision, assists'],
    ['speed', 'Speed', 'Top speed up the floor'],
    ['vert', 'Vertical', 'Jumping, rebounds, blocks'],
    ['perD', 'Perimeter D', 'Staying in front, contests'],
    ['inD', 'Interior D', 'Protecting the paint'],
    ['steal', 'Steal', 'Reaching and jumping lanes'],
    ['block', 'Block', 'Swatting shots'],
    ['reb', 'Rebound', 'Winning the ball off the rim'],
  ];
  PB.POS = ['PG', 'SG', 'SF', 'PF', 'C'];
  PB.POS_NAME = { PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward', C: 'Center' };
  /* height range in inches */
  PB.HEIGHT = { PG: [69, 79], SG: [72, 81], SF: [75, 83], PF: [77, 85], C: [79, 89] };   // a wide range each: a 5'9" point guard to a 7'5" center
  PB.fmtH = inch => `${Math.floor(inch / 12)}'${inch % 12}"`;

  /* How much each attribute counts toward the overall at each position. */
  const W = {
    PG: { close: 1, dunk: .3, mid: 1, three: 1.4, ft: .4, handle: 1.6, pass: 1.6, speed: 1.2, vert: .4, perD: 1, inD: .2, steal: .8, block: .1, reb: .3 },
    SG: { close: 1, dunk: .5, mid: 1.3, three: 1.6, ft: .5, handle: 1.1, pass: .8, speed: 1.1, vert: .5, perD: 1.1, inD: .2, steal: .8, block: .2, reb: .4 },
    SF: { close: 1.1, dunk: .8, mid: 1.1, three: 1.2, ft: .4, handle: .8, pass: .7, speed: 1, vert: .8, perD: 1.1, inD: .6, steal: .7, block: .5, reb: .8 },
    PF: { close: 1.3, dunk: 1.1, mid: .8, three: .7, ft: .3, handle: .4, pass: .5, speed: .7, vert: 1, perD: .7, inD: 1.2, steal: .4, block: 1, reb: 1.4 },
    C: { close: 1.5, dunk: 1.3, mid: .5, three: .4, ft: .3, handle: .2, pass: .5, speed: .5, vert: 1, perD: .4, inD: 1.6, steal: .3, block: 1.5, reb: 1.7 },
  };
  PB.ovr = (r, pos) => {
    const w = W[pos]; let s = 0, n = 0;
    for (const k in w) { s += r[k] * w[k]; n += w[k]; }
    /* the weighted average of a good player sits near 70; stretch it so stars read 85-95 */
    return Math.round(PB.clamp(40 + (s / n - 50) * 1.45, 35, 99));
  };

  /* Archetypes: starting ratings and the ceiling each attribute can be trained to. */
  PB.ARCH = {
    Sharpshooter: { pos: ['PG', 'SG', 'SF'], tag: 'Lights out from three', base: { three: 72, mid: 66, ft: 74, close: 55, dunk: 40, handle: 58, pass: 55, speed: 64, vert: 52, perD: 50, inD: 35, steal: 48, block: 32, reb: 40 },
      cap: { three: 99, mid: 95, ft: 99, close: 80, dunk: 65, handle: 85, pass: 82, speed: 85, vert: 75, perD: 78, inD: 55, steal: 75, block: 55, reb: 65 } },
    Slasher: { pos: ['PG', 'SG', 'SF'], tag: 'Lives at the rim', base: { three: 52, mid: 58, ft: 66, close: 72, dunk: 70, handle: 66, pass: 54, speed: 74, vert: 72, perD: 54, inD: 40, steal: 52, block: 40, reb: 48 },
      cap: { three: 80, mid: 85, ft: 88, close: 99, dunk: 99, handle: 92, pass: 80, speed: 97, vert: 97, perD: 82, inD: 60, steal: 80, block: 65, reb: 72 } },
    Playmaker: { pos: ['PG', 'SG'], tag: 'Runs the show', base: { three: 60, mid: 62, ft: 70, close: 62, dunk: 45, handle: 74, pass: 76, speed: 70, vert: 55, perD: 54, inD: 35, steal: 58, block: 30, reb: 40 },
      cap: { three: 88, mid: 90, ft: 92, close: 88, dunk: 70, handle: 99, pass: 99, speed: 95, vert: 78, perD: 82, inD: 50, steal: 88, block: 50, reb: 62 } },
    'Two-Way Wing': { pos: ['SG', 'SF', 'PF'], tag: 'Scores and locks up', base: { three: 60, mid: 60, ft: 64, close: 62, dunk: 60, handle: 56, pass: 52, speed: 66, vert: 64, perD: 70, inD: 55, steal: 62, block: 52, reb: 54 },
      cap: { three: 88, mid: 86, ft: 85, close: 88, dunk: 88, handle: 82, pass: 78, speed: 90, vert: 90, perD: 99, inD: 85, steal: 95, block: 82, reb: 80 } },
    'Stretch Big': { pos: ['PF', 'C'], tag: 'A big who shoots it', base: { three: 64, mid: 64, ft: 68, close: 64, dunk: 58, handle: 46, pass: 52, speed: 52, vert: 56, perD: 50, inD: 60, steal: 40, block: 56, reb: 64 },
      cap: { three: 95, mid: 92, ft: 90, close: 88, dunk: 82, handle: 70, pass: 80, speed: 72, vert: 78, perD: 72, inD: 88, steal: 62, block: 85, reb: 90 } },
    'Rim Protector': { pos: ['PF', 'C'], tag: 'Owns the paint', base: { three: 35, mid: 45, ft: 56, close: 68, dunk: 72, handle: 38, pass: 46, speed: 50, vert: 66, perD: 48, inD: 74, steal: 42, block: 74, reb: 74 },
      cap: { three: 60, mid: 72, ft: 80, close: 95, dunk: 99, handle: 60, pass: 75, speed: 70, vert: 92, perD: 70, inD: 99, steal: 65, block: 99, reb: 99 } },
  };

  /* every build starts five points up on its base (a rookie near 60 overall), never past a ceiling */
  for (const A of Object.values(PB.ARCH)) for (const k in A.base) A.base[k] = Math.min(A.cap[k], A.base[k] + 5);

  /* A computer player at a position and a talent tier (overall it aims for). */
  const POS_SHAPE = {
    PG: { three: 4, mid: 2, ft: 6, close: 0, dunk: -10, handle: 10, pass: 10, speed: 8, vert: -4, perD: 2, inD: -16, steal: 4, block: -18, reb: -14 },
    SG: { three: 6, mid: 4, ft: 6, close: 0, dunk: -2, handle: 4, pass: 0, speed: 5, vert: 0, perD: 3, inD: -12, steal: 3, block: -12, reb: -10 },
    SF: { three: 1, mid: 2, ft: 2, close: 2, dunk: 2, handle: 0, pass: -2, speed: 2, vert: 3, perD: 4, inD: -2, steal: 1, block: -3, reb: -2 },
    PF: { three: -6, mid: -2, ft: -4, close: 5, dunk: 6, handle: -10, pass: -5, speed: -5, vert: 3, perD: -4, inD: 7, steal: -4, block: 6, reb: 9 },
    C: { three: -16, mid: -8, ft: -10, close: 8, dunk: 10, handle: -18, pass: -6, speed: -10, vert: 2, perD: -10, inD: 12, steal: -8, block: 12, reb: 14 },
  };
  PB.makeRatings = (pos, target) => {
    const r = {};
    for (const [k] of PB.ATTRS) r[k] = Math.round(PB.clamp(target - 6 + POS_SHAPE[pos][k] + PB.gauss() * 6, 25, 99));
    /* nudge toward the target overall */
    for (let i = 0; i < 6; i++) {
      const d = target - PB.ovr(r, pos);
      if (Math.abs(d) < 1) break;
      for (const k in r) r[k] = Math.round(PB.clamp(r[k] + d * 0.6, 25, 99));
    }
    return r;
  };

  let pid = 1;
  /* text on a team color: the second color when it reads, else white or near-black, whichever stands out more */
  PB.ink = (bg, fg) => {
    const L = h => { const v = [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) / 255).map(c => c <= 0.04 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const b = L(bg); if (cr(b, L(fg)) >= 2.6) return fg;
    return cr(b, 1) >= cr(b, L('#111111')) ? '#ffffff' : '#111111';
  };
  /* a team's uniforms. 'icon' in its colors, 'assoc' white with its colors as trim, 'city' black with its colors as
     accents. Each team has its own design (side panels, pinstripes, a chest band, a fade, shoulder yokes, a sash) */
  PB.kit = (t, which) => {
    let h = 0; for (const ch of String(t.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pat = [1, 2, 3, 4, 5, 6, 1, 3, 5, 2][h % 10], light = c => { const n = parseInt(String(c).slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 200; };
    if (which === 'assoc') return { c1: '#f2f2f2', c2: light(t.c1) ? t.c2 : t.c1, alt: light(t.c1) ? t.c2 : t.c1, pat, name: t.name, kind: 'assoc' };
    if (which === 'statement') {
      const dk = c => { const n = parseInt(String(c).slice(1), 16), f = 0.55, h2 = x => Math.round(x * f).toString(16).padStart(2, '0'); return '#' + h2(n >> 16) + h2((n >> 8) & 255) + h2(n & 255); };
      const base = light(t.c2) ? dk(t.c1) : t.c2;
      return { c1: base, c2: light(t.c2) ? t.c2 : t.c1, alt: t.c1, pat: [3, 1, 5, 2][h % 4], name: t.name, kind: 'statement' };
    }
    if (which === 'city') return { c1: '#141416', c2: t.c1 === '#000000' || !light(t.c2) && false ? t.c2 : t.c1, alt: t.c1, pat: [1, 6, 2, 5][h % 4], name: t.city.toUpperCase(), kind: 'city' };
    return { c1: t.c1, c2: t.c2, alt: t.c2, pat, name: t.name, kind: 'icon' };
  };
  /* the floor in eleven zones, the way a scouting report cuts it: x across (feet from the middle), a out from the rim */
  PB.zoneOf = (x, a) => { const d = Math.hypot(x, a), three = d >= 23.4 || (Math.abs(x) >= 21.8 && a < 9.5);
    if (!three) return d < 5 ? 'rim' : d < 11 && Math.abs(x) < 8.5 ? 'paint' : x < -6 ? 'midL' : x > 6 ? 'midR' : 'midC';
    return a < 9.5 ? (x < 0 ? 'cornerL' : 'cornerR') : Math.abs(x) < 8 ? 'top3' : x < 0 ? 'wingL' : 'wingR'; };
  /* each zone: where its label sits on the chart, and what the league shoots from there */
  PB.ZONES = { rim: [0, 2.5, 62], paint: [0, 8.5, 43], midL: [-14, 9, 40], midC: [0, 17, 41], midR: [14, 9, 40], cornerL: [-23.4, 3, 38], cornerR: [23.4, 3, 38], wingL: [-18.5, 21, 35], top3: [0, 27.5, 35], wingR: [18.5, 21, 35] };
  PB.randName = () => { const n = PB.person(); return n.first + ' ' + n.last; };
  PB.makePlayer = (pos, target, age) => {
    const h = PB.HEIGHT[pos];
    const n = PB.person();
    const p = { id: 'p' + (pid++) + '_' + Math.floor(PB.rand() * 1e6), first: n.first, last: n.last, from: n.from, org: n.org, pos,
      ht: Math.round((PB.ri(h[0], h[1]) + PB.ri(h[0], h[1])) / 2), age: age || PB.ri(20, 34), num: PB.ri(0, 55), r: PB.makeRatings(pos, target), skin: n.skin };
    p.ovr = PB.ovr(p.r, pos);
    return p;
  };

  /* A newcomer to a team: not a teammate's first or last name, not a full name the league already has, not a real player's */
  PB.freshName = (p, roster, rosters) => {
    const taken = new Set(); for (const id in rosters || {}) for (const q of rosters[id]) if (q !== p) taken.add(q.first + ' ' + q.last);
    const o = PB.origin(p.org), mates = roster.filter(q => q !== p);
    for (let k = 0; k < 30 && (mates.some(q => q.last === p.last) || taken.has(p.first + ' ' + p.last) || PB.REAL.has(p.first + ' ' + p.last)); k++) p.last = PB.pick(o.last);
    for (let k = 0; k < 30 && (mates.some(q => q.first === p.first) || taken.has(p.first + ' ' + p.last) || PB.REAL.has(p.first + ' ' + p.last)); k++) p.first = PB.pick(o.first);
    return p;
  };

  /* A roster: five starters and five reserves, with a talent level set by the team's strength. */
  PB.makeRoster = (strength, taken) => {   // taken: a Set of full names shared across a league, so no two players in it carry the same one
    const out = [], used = new Set();
    const tiers = [strength + 6, strength + 2, strength, strength - 2, strength - 4, strength - 8, strength - 9, strength - 11, strength - 13, strength - 15];
    const pos = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C'];
    tiers.forEach((t, i) => {
      const p = PB.makePlayer(pos[i], Math.round(t + PB.gauss() * 2));
      while (used.has(p.num)) p.num = PB.ri(0, 55);
      used.add(p.num);
      for (let k = 0; k < 20 && (out.some(q => q.last === p.last) || PB.REAL.has(p.first + ' ' + p.last)); k++) p.last = PB.pick(PB.origin(p.org).last);   // no two Harmons on one bench
      for (let k = 0; k < 20 && (out.some(q => q.first === p.first) || PB.REAL.has(p.first + ' ' + p.last)); k++) p.first = PB.pick(PB.origin(p.org).first);   // nor two Lonnies
      if (taken) { for (let k = 0; k < 30 && taken.has(p.first + ' ' + p.last); k++) { const o = PB.origin(p.org), f = PB.pick(o.first), l = PB.pick(o.last);
        if (k % 2 ? !out.some(q => q.last === l) : !out.some(q => q.first === f)) { if (k % 2) p.last = l; else p.first = f; }
        if (PB.REAL.has(p.first + ' ' + p.last)) p.last = PB.pick(o.last); }
        taken.add(p.first + ' ' + p.last); }
      out.push(p);
    });
    return out;
  };
  PB.teamOvr = roster => {
    const s = roster.map(p => p.ovr).sort((a, b) => b - a);
    return Math.round((s[0] * 1.3 + s[1] * 1.2 + s[2] * 1.1 + s[3] + s[4] + (s[5] + s[6] + s[7]) * 0.6) / 7.0);
  };

  /* Badges: earned by doing the thing in games (career totals), never lost. Three tiers. `stat` is the counter. */
  PB.BADGES = [
    { k: 'deep', name: 'Deep Range', stat: 'tpm', desc: 'Threes made', tiers: [25, 100, 250], eff: 'Better from three, and from way out' },
    { k: 'catch', name: 'Catch & Shoot', stat: 'cs3', desc: 'Threes off a pass', tiers: [15, 60, 150], eff: 'Better shooting right off the catch' },
    { k: 'mid', name: 'Mid-Range Maestro', stat: 'mid', desc: 'Mid-range makes', tiers: [20, 80, 200], eff: 'Better pull-ups and elbow jumpers' },
    { k: 'acro', name: 'Acrobat', stat: 'lay', desc: 'Layups and floaters made', tiers: [30, 120, 300], eff: 'Finishes better through traffic' },
    { k: 'poster', name: 'Posterizer', stat: 'dunk', desc: 'Dunks', tiers: [10, 40, 100], eff: 'Goes up for the dunk more often' },
    { k: 'handles', name: 'Handles', stat: 'shake', desc: 'Defenders shaken', tiers: [5, 20, 50], eff: 'Crossovers leave defenders stumbling more' },
    { k: 'general', name: 'Floor General', stat: 'ast', desc: 'Assists', tiers: [60, 250, 600], eff: 'Passes are picked off less' },
    { k: 'glass', name: 'Glass Cleaner', stat: 'reb', desc: 'Rebounds', tiers: [100, 400, 1000], eff: 'Wins more boards' },
    { k: 'pick', name: 'Pickpocket', stat: 'stl', desc: 'Steals', tiers: [20, 80, 200], eff: 'Reaches come away with it more' },
    { k: 'rim', name: 'Rim Protector', stat: 'blk', desc: 'Blocks', tiers: [15, 60, 150], eff: 'Blocks more shots' },
    { k: 'lock', name: 'Lockdown', stat: 'cmiss', desc: 'Contested misses forced', tiers: [20, 80, 200], eff: 'Your contests take more off a shot' },
    { k: 'clutch', name: 'Clutch', stat: 'clutch', desc: 'Points in the last two minutes of a 4th', tiers: [15, 60, 150], eff: 'Better shooting late in close games' },
    { k: 'fade', name: 'Fadeaway Artist', stat: 'fade', desc: 'Fadeaways made', tiers: [10, 40, 100], eff: 'Fadeaways go in more' },
    { k: 'post', name: 'Post Scorer', stat: 'hookm', desc: 'Hooks made', tiers: [10, 40, 100], eff: 'Hooks go in more' },
  ];
  PB.TIER = ['', 'Bronze', 'Silver', 'Gold'];
  PB.SKIN = ['#f1d1b5', '#e0b48f', '#c68e63', '#a26a42', '#7a4a2a', '#4f2f1c'];
  PB.ini = p => `${p.first[0]}. ${p.last}`;
  PB.full = p => `${p.first} ${p.last}`;
})();
