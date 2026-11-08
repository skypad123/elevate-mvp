import { type QuizDefinitionInput, type RichTextDoc, textDoc } from '@elevate/core'

export type SeedArtefact =
  | { type: 'text'; title: string; content: RichTextDoc; minutes?: number }
  | { type: 'quiz'; title: string; quiz: QuizDefinitionInput }

export type SeedLesson = {
  key: string
  title: string
  summary: string
  prerequisites?: string[]
  artefacts: SeedArtefact[]
}

export type SeedCourse = {
  slug: string
  title: string
  summary: string
  category: string
  priceCents: number
  status: 'draft' | 'pending_review' | 'live'
  teacherEmail: string
  description: string
  accent: string
  lessons: SeedLesson[]
}

export type SeedTeacher = {
  email: string
  name: string
  displayName: string
  headline: string
  bio: string
  credentials: string
  commissionBps: number
}

const text = (title: string, ...paragraphs: string[]): SeedArtefact => ({
  type: 'text',
  title,
  content: textDoc(paragraphs.join('\n\n')),
  minutes: Math.max(2, Math.round(paragraphs.join(' ').split(/\s+/).length / 120)),
})

const q = (
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation?: string,
): QuizDefinitionInput['questions'][number] => ({
  id: prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40),
  prompt,
  ...(explanation ? { explanation } : {}),
  options: options.map((o, i) => ({ id: `o${i + 1}`, text: o, correct: i === correctIndex })),
})

const quiz = (
  title: string,
  passMarkPercent: number,
  questions: QuizDefinitionInput['questions'],
): SeedArtefact => ({
  type: 'quiz',
  title,
  quiz: { passMarkPercent, maxAttempts: 2, timeLimitMinutes: null, questions },
})

export const seedTeachers: SeedTeacher[] = [
  {
    email: 'meilin@example.com',
    name: 'Mei Lin Tan',
    displayName: 'Mei Lin Tan',
    headline: 'Ceramicist and studio teacher, Jalan Bahar',
    bio: 'Mei Lin has thrown pots for twelve years and taught beginners for eight. Her studio classes focus on patience, repetition and learning to read clay with your hands rather than your eyes.',
    credentials:
      'Diploma in Fine Arts (Ceramics), LASALLE. Resident artist at Jalan Bahar Clay Studios since 2018. Over 600 students taught in studio.',
    commissionBps: 1500,
  },
  {
    email: 'daniel@example.com',
    name: 'Daniel Goh',
    displayName: 'Daniel Goh',
    headline: 'Sourdough baker and former restaurant pastry chef',
    bio: 'Daniel ran the pastry section at a Tiong Bahru bistro before turning his home kitchen into a micro-bakery. He teaches bread the way he learned it: by weight, by feel, and with a lot of notes.',
    credentials:
      'Grand Diplôme, Le Cordon Bleu Paris. 9 years in professional kitchens. Author of the Humid Kitchen baking newsletter.',
    commissionBps: 1500,
  },
  {
    email: 'priya@example.com',
    name: 'Priya Nair',
    displayName: 'Priya Nair',
    headline: 'Staff product designer, design systems',
    bio: 'Priya has shipped design systems at two fintechs and mentors early-career designers. Her courses are built around the files you will actually ship, not toy examples.',
    credentials:
      'BA Interaction Design, NTU ADM. Staff Product Designer. Speaker at Figma Config 2025.',
    commissionBps: 1800,
  },
  {
    email: 'adrian@example.com',
    name: 'Adrian Lee',
    displayName: 'Adrian Lee',
    headline: 'Street and documentary photographer',
    bio: 'Adrian has photographed Singapore’s streets for fifteen years and leads small walking workshops through Chinatown, Geylang and Little India.',
    credentials:
      'Documentary work published in The Straits Times and Rice Media. Leica Akademie workshop instructor.',
    commissionBps: 2000,
  },
]

export const seedCourses: SeedCourse[] = [
  {
    slug: 'wheel-thrown-ceramics-for-beginners',
    title: 'Wheel-thrown Ceramics for Beginners',
    summary:
      'Centre, open and pull your first cylinders and bowls, then trim and prepare them for the kiln.',
    category: 'craft-making',
    priceCents: 18900,
    status: 'live',
    teacherEmail: 'meilin@example.com',
    accent: '#0F6B52',
    description:
      'Most beginners fight the wheel. This course teaches you to stop. Over four lessons you will learn to wedge and centre clay, open and pull walls, shape bowls, and trim feet. Every lesson ends with a short drill you can repeat at any community studio.\n\nYou will need access to a wheel, 5kg of stoneware clay, a sponge, a wire and a wooden rib.',
    lessons: [
      {
        key: 'wedge-centre',
        title: 'Wedging and centring',
        summary: 'Prepare clay and get it perfectly still on the wheel.',
        artefacts: [
          text(
            'Why wedging matters',
            'Wedging aligns the clay particles and removes air pockets that would otherwise explode in the kiln. Spiral wedging takes practice; ram’s head wedging is enough for your first month.',
            'Aim for 30 strokes per 1kg of clay. The surface should look like a smooth shell with no folds. If you see cracks, the clay is too dry: spray it and let it rest wrapped for an hour.',
          ),
          text(
            'Centring: pressure, not force',
            'Brace your elbows against your thighs and lean into the clay with your whole body. Your hands should stay still while the wheel does the work. Cone the clay up, then press it down three times.',
            'A centred lump looks motionless at full speed. Touch it with a fingernail: if the line is unbroken you are ready to open.',
          ),
          quiz('Check: wedging and centring', 70, [
            q(
              'What does wedging remove from the clay?',
              ['Water', 'Air pockets', 'Grog', 'Colour'],
              1,
              'Trapped air expands in the kiln and can crack the piece.',
            ),
            q(
              'Where should the pressure for centring come from?',
              ['Your fingertips', 'Your wrists', 'Your braced body weight', 'The wheel speed'],
              2,
            ),
            q(
              'How do you know the clay is centred?',
              [
                'It is shiny',
                'It looks motionless at speed',
                'It is cold',
                'It is taller than wide',
              ],
              1,
            ),
          ]),
        ],
      },
      {
        key: 'open-pull',
        title: 'Opening and pulling a cylinder',
        summary: 'From a centred lump to a straight-walled cylinder.',
        prerequisites: ['wedge-centre'],
        artefacts: [
          text(
            'Opening the floor',
            'Press your thumbs into the centre until roughly 8mm of clay remains at the base. Pull outwards slowly to set the floor width. Compress the floor with a sponge to prevent S-cracks.',
          ),
          text(
            'Three pulls',
            'Pinch the wall between your inside fingers and outside knuckle, then lift together at a steady speed. Each pull should take about eight seconds. Three good pulls beat eight nervous ones.',
            'Collar the rim gently after each pull to keep the cylinder from flaring. If the wall twists, slow the wheel down, not your hands.',
          ),
        ],
      },
      {
        key: 'bowls',
        title: 'Shaping bowls',
        summary: 'Turning a cylinder into a bowl with a continuous curve.',
        prerequisites: ['wedge-centre'],
        artefacts: [
          text(
            'The curve lives on the inside',
            'A bowl is defined by its inside curve. Use a rib on the inside and support the outside with your hand. Open wider than a cylinder and keep the floor thicker, because you will trim a foot later.',
            'Stop while the rim is still even. Overworked rims slump; a bowl that is slightly small and true beats a large one that is wobbling.',
          ),
        ],
      },
      {
        key: 'trimming',
        title: 'Trimming and preparing for the kiln',
        summary: 'Leather-hard trimming, feet, and drying without cracks.',
        prerequisites: ['open-pull', 'bowls'],
        artefacts: [
          text(
            'Leather hard, not bone dry',
            'Trim when the piece no longer dents under a fingernail but still feels cool. Centre it upside down, tap it into place and cut a foot ring about a third of the base diameter.',
            'Dry pieces slowly under plastic for two days, then uncovered for two more. Uneven drying is the main cause of cracks before the bisque firing.',
          ),
          quiz('Final check: from wheel to kiln', 70, [
            q(
              'When is clay ready to trim?',
              ['Freshly thrown', 'Leather hard', 'Bone dry', 'After bisque'],
              1,
            ),
            q(
              'Roughly how wide should a foot ring be?',
              ['The full base', 'A third of the base', 'As thin as possible', 'It does not matter'],
              1,
            ),
            q(
              'What is the most common cause of cracks before bisque?',
              ['Too much glaze', 'Uneven drying', 'Wedging too long', 'A thin rim'],
              1,
            ),
            q(
              'What compresses the floor and prevents S-cracks?',
              ['A wire', 'A sponge', 'A needle tool', 'Trimming'],
              1,
            ),
          ]),
        ],
      },
    ],
  },
  {
    slug: 'glazing-fundamentals',
    title: 'Glazing Fundamentals',
    summary:
      'Understand what glaze is made of, how to mix and apply it, and how to read your results after firing.',
    category: 'craft-making',
    priceCents: 12000,
    status: 'live',
    teacherEmail: 'meilin@example.com',
    accent: '#2F5FD6',
    description:
      'Glaze is chemistry you can hold. This short course demystifies silica, flux and alumina, shows safe mixing and sieving, and walks through dipping, pouring and brushing. You will finish by reading a set of fired test tiles.',
    lessons: [
      {
        key: 'what-is-glaze',
        title: 'What a glaze is',
        summary: 'Glass former, flux, stabiliser.',
        artefacts: [
          text(
            'Three ingredients',
            'Every glaze is a glass former (silica), a flux that lowers its melting point, and a stabiliser (alumina) that stops it running off the pot. Colourants and opacifiers are the small percentages on top.',
            'When a glaze crawls, runs or pinholes, the cause is almost always one of those three ratios or the thickness of application.',
          ),
        ],
      },
      {
        key: 'mixing-applying',
        title: 'Mixing and applying',
        summary: 'Sieve, measure specific gravity, dip.',
        prerequisites: ['what-is-glaze'],
        artefacts: [
          text(
            'Mix, sieve, measure',
            'Wear a respirator when handling dry materials. Mix to a thick-cream consistency and sieve twice through an 80 mesh. Measure specific gravity with a 100ml cup: most dipping glazes sit around 1.45.',
            'Dip for three seconds, hold upside down for a count of five, and wipe the foot clean. Two thin coats beat one thick one.',
          ),
          quiz('Check: glaze basics', 60, [
            q(
              'Which ingredient is the glass former?',
              ['Alumina', 'Silica', 'Feldspar', 'Cobalt'],
              1,
            ),
            q(
              'What does a flux do?',
              ['Adds colour', 'Lowers the melting point', 'Thickens the glaze', 'Makes it matte'],
              1,
            ),
            q(
              'A typical specific gravity for a dipping glaze is about…',
              ['1.00', '1.45', '2.50', '4.00'],
              1,
            ),
          ]),
        ],
      },
    ],
  },
  {
    slug: 'sourdough-from-scratch',
    title: 'Sourdough from Scratch',
    summary:
      'Build a starter in a humid kitchen, mix and fold a high-hydration dough, and bake a loaf with a real ear.',
    category: 'food-drink',
    priceCents: 8900,
    status: 'live',
    teacherEmail: 'daniel@example.com',
    accent: '#B4781B',
    description:
      'Written for Singapore kitchens: 30°C rooms, no proving drawer, and supermarket flour. You will build a starter from nothing in a week, learn to judge fermentation by sight and smell, and bake in a Dutch oven or on a tray with steam.',
    lessons: [
      {
        key: 'starter',
        title: 'Building a starter',
        summary: 'Seven days to an active culture.',
        artefacts: [
          text(
            'Day one to day seven',
            'Mix 50g wholemeal flour with 50g water and leave it loosely covered. From day three, discard half and feed with 50g bread flour and 50g water every 12 hours. In a 30°C kitchen it will be ready by day six or seven.',
            'A ready starter doubles within four to six hours and smells like yoghurt and green apple, not nail varnish. If it smells of acetone it is hungry: feed it twice before using.',
          ),
          quiz('Check: starter health', 70, [
            q(
              'A ready starter smells like…',
              ['Nail varnish', 'Yoghurt and green apple', 'Nothing', 'Vinegar only'],
              1,
            ),
            q(
              'In a warm kitchen, how often should you feed a young starter?',
              ['Once a week', 'Every 12 hours', 'Every 48 hours', 'Only when it collapses'],
              1,
            ),
          ]),
        ],
      },
      {
        key: 'mix-fold',
        title: 'Mixing and folding',
        summary: 'Autolyse, salt, and four sets of folds.',
        prerequisites: ['starter'],
        artefacts: [
          text(
            'The formula',
            '500g bread flour, 375g water (75% hydration), 100g active starter, 10g salt. Mix flour and water first and rest for 45 minutes, then work in the starter and salt with wet hands.',
            'Do four sets of stretch-and-folds 30 minutes apart. In a warm kitchen bulk fermentation takes three to four hours total. Stop when the dough has grown by half and jiggles like set custard.',
          ),
        ],
      },
      {
        key: 'shape-bake',
        title: 'Shaping and baking',
        summary: 'Pre-shape, cold retard, score, bake.',
        prerequisites: ['mix-fold'],
        artefacts: [
          text(
            'Cold retard is your friend',
            'Pre-shape into a loose round, rest 20 minutes, then shape tightly into a banneton and refrigerate 12 to 16 hours. Cold dough scores cleanly and the long retard builds flavour you cannot get at room temperature.',
            'Bake at 250°C covered for 20 minutes, then 220°C uncovered for 20 to 25 minutes until deep brown. Cool fully before cutting: the crumb is still setting for an hour.',
          ),
          quiz('Final check: the whole loaf', 70, [
            q('What hydration is 375g water to 500g flour?', ['65%', '70%', '75%', '80%'], 2),
            q(
              'Why retard the dough in the fridge?',
              [
                'To make it rise faster',
                'For flavour and clean scoring',
                'To kill the yeast',
                'To dry the crust',
              ],
              1,
            ),
            q(
              'When should you cut the loaf?',
              ['Immediately', 'After 10 minutes', 'After it has cooled fully', 'The next day only'],
              2,
            ),
          ]),
        ],
      },
    ],
  },
  {
    slug: 'figma-to-prototype',
    title: 'Figma to Prototype',
    summary:
      'Turn a static mockup into a clickable prototype with components, variants and smart animate.',
    category: 'design',
    priceCents: 14900,
    status: 'live',
    teacherEmail: 'priya@example.com',
    accent: '#E8603C',
    description:
      'A compact course for designers who can draw screens but freeze at prototyping. You will structure a file, build components with variants, wire flows, and present a prototype that survives a stakeholder review.',
    lessons: [
      {
        key: 'file-structure',
        title: 'Structuring the file',
        summary: 'Pages, frames and naming that scales.',
        artefacts: [
          text(
            'One page per purpose',
            'Keep a cover page, a components page, one page per flow and a scratch page. Name frames by flow and step (Checkout / 02 Address). Future you, and every engineer, will thank you.',
          ),
        ],
      },
      {
        key: 'components',
        title: 'Components and variants',
        summary: 'Buttons, inputs and cards with real states.',
        prerequisites: ['file-structure'],
        artefacts: [
          text(
            'States are not afterthoughts',
            'Build the default, hover, pressed, disabled and loading states of a button as variants from day one. Use boolean properties for icons and text properties for labels so instances stay editable.',
          ),
          quiz('Check: components', 70, [
            q(
              'Which property type toggles an icon on an instance?',
              ['Text', 'Boolean', 'Variant', 'Instance swap'],
              1,
            ),
            q(
              'Why name frames by flow and step?',
              [
                'Figma requires it',
                'For handoff and navigation',
                'It renders faster',
                'For export only',
              ],
              1,
            ),
          ]),
        ],
      },
      {
        key: 'prototype',
        title: 'Wiring the prototype',
        summary: 'Flows, overlays and smart animate.',
        prerequisites: ['components'],
        artefacts: [
          text(
            'Make it feel real',
            'Start each flow from a named starting point. Use overlays for sheets and dialogs, and smart animate only when layers share names. Record a two-minute walkthrough before the review so the prototype is not the only thing that can go wrong.',
          ),
        ],
      },
    ],
  },
  {
    slug: 'design-systems-that-scale',
    title: 'Design Systems that Scale',
    summary: 'Tokens, components, documentation and governance for teams of five to fifty.',
    category: 'design',
    priceCents: 19900,
    status: 'live',
    teacherEmail: 'priya@example.com',
    accent: '#1F7A4D',
    description:
      'The decisions that make a design system survive its second year: a token architecture that engineers can consume, a component contribution process, and documentation people actually read.',
    lessons: [
      {
        key: 'tokens',
        title: 'Token architecture',
        summary: 'Primitive, semantic, component.',
        artefacts: [
          text(
            'Three tiers',
            'Primitive tokens name raw values (green-700). Semantic tokens name intent (color-brand). Component tokens name usage (button-bg). Only semantic tokens should appear in product code.',
          ),
        ],
      },
      {
        key: 'governance',
        title: 'Governance',
        summary: 'Contribution, versioning, deprecation.',
        prerequisites: ['tokens'],
        artefacts: [
          text(
            'A system is a product',
            'Give the system a roadmap, a changelog and a deprecation policy. Review contributions like code. Publish releases with semantic versions so product teams can upgrade on their own schedule.',
          ),
          quiz('Check: systems', 70, [
            q(
              'Which token tier should product code use?',
              ['Primitive', 'Semantic', 'Component only', 'None'],
              1,
            ),
            q(
              'Why version a design system?',
              [
                'For marketing',
                'So teams can upgrade deliberately',
                'Figma requires it',
                'To slow changes',
              ],
              1,
            ),
          ]),
        ],
      },
    ],
  },
  {
    slug: 'street-photography-in-singapore',
    title: 'Street Photography in Singapore',
    summary:
      'Light, timing and courage: how to photograph strangers in public with respect and intent.',
    category: 'photography-film',
    priceCents: 7900,
    status: 'live',
    teacherEmail: 'adrian@example.com',
    accent: '#575B57',
    description:
      'Shot entirely in Chinatown, Geylang and Little India. Learn to read tropical light, pre-focus for the decisive moment, and approach people. Includes Adrian’s rules for photographing in Singapore’s public spaces.',
    lessons: [
      {
        key: 'light',
        title: 'Reading tropical light',
        summary: 'Harsh noon, soft five-foot-ways, blue hour.',
        artefacts: [
          text(
            'Shoot the shade',
            'Between 11am and 3pm the sun is directly overhead. Work the five-foot-ways and void decks, where bounced light wraps faces. Expose for highlights and let the shadows fall.',
          ),
        ],
      },
      {
        key: 'moment',
        title: 'The decisive moment',
        summary: 'Zone focus and anticipation.',
        prerequisites: ['light'],
        artefacts: [
          text(
            'Pre-focus and wait',
            'Set 35mm, f/8, focus at 2.5m and everything from 1.5m to 5m is sharp. Find a background, then wait for the person. The frame is built before the subject arrives.',
          ),
          quiz('Check: light and timing', 60, [
            q(
              'Where is the light softest at noon?',
              ['Open road', 'Five-foot-ways and void decks', 'Rooftops', 'The beach'],
              1,
            ),
            q(
              'Zone focusing means…',
              [
                'Autofocus on faces',
                'Pre-setting focus distance and aperture',
                'Shooting wide open',
                'Using a zoom',
              ],
              1,
            ),
          ]),
        ],
      },
    ],
  },
  {
    slug: 'enriched-doughs',
    title: 'Enriched Doughs: Brioche, Milk Bread and Buns',
    summary: 'Butter, eggs and tangzhong: soft breads that stay soft in the tropics.',
    category: 'food-drink',
    priceCents: 9900,
    status: 'pending_review',
    teacherEmail: 'daniel@example.com',
    accent: '#B4781B',
    description:
      'From a basic brioche to Hokkaido milk bread and char siu bao-style baked buns. Submitted for review.',
    lessons: [
      {
        key: 'brioche',
        title: 'Brioche',
        summary: 'Working butter into dough.',
        artefacts: [
          text(
            'Butter in stages',
            'Add cold butter one cube at a time only after the gluten has developed. The dough should pull away from the bowl and pass the windowpane test.',
          ),
          quiz('Check: brioche', 70, [
            q(
              'When do you add the butter?',
              ['Before the flour', 'After gluten develops', 'With the yeast', 'Never'],
              1,
            ),
          ]),
        ],
      },
    ],
  },
  {
    slug: 'raku-firing-weekend',
    title: 'Raku Firing Weekend',
    summary: 'A two-day outdoor raku firing: reduction, crackle and horsehair.',
    category: 'craft-making',
    priceCents: 24900,
    status: 'draft',
    teacherEmail: 'meilin@example.com',
    accent: '#0F6B52',
    description: 'Draft. Content being written.',
    lessons: [],
  },
]
