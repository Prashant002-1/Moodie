import axios from 'axios';
import bcrypt from 'bcryptjs';
import pool, { ConnectedDatabaseClient, initializeDatabase } from '../config/database';
import { env } from '../config/env';

const TMDB_API_KEY = env.tmdbApiKey;

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const SEED_PREFIX = 'emotionflix:v2:';
const SEED_REFERENCE_DATE = '2026-07-13';

type EmotionScores = {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
};

type SeedEntry = {
  key: string;
  title: string;
  year: number;
  note: string;
  visibility: 'private' | 'public';
  emotions: EmotionScores;
  expressionPhoto?: { assetPath: string; altText: string };
};

const emos = (
  neutral = 0.08,
  happy = 0.08,
  sad = 0.08,
  angry = 0.08,
  fearful = 0.08,
  disgusted = 0.08,
  surprised = 0.08,
): EmotionScores => ({ neutral, happy, sad, angry, fearful, disgusted, surprised });

const post = (
  key: string,
  title: string,
  year: number,
  note: string,
  visibility: 'private' | 'public',
  emotions: EmotionScores,
  expressionPhoto?: SeedEntry['expressionPhoto'],
): SeedEntry => ({ key, title, year, note, visibility, emotions, expressionPhoto });

const SEED_USERS = [
  { email: 'demo@demo.com', username: 'demo', password: 'demo123!', bio: 'I keep films close when they help me name a feeling I could not explain on my own.' },
  { email: 'clara@seed.emotionflix.com', username: 'clara_valdez', password: 'seed123!', bio: 'I return to films that make loneliness feel shared, especially when tenderness survives the ending.' },
  { email: 'marcus@seed.emotionflix.com', username: 'marcus_k', password: 'seed123!', bio: 'I love the startled feeling of having my sense of reality loosen, then finding something human inside it.' },
  { email: 'elena@seed.emotionflix.com', username: 'elena_r', password: 'seed123!', bio: 'I hold onto films that make time feel precious and leave me missing lives I never actually lived.' },
  { email: 'hiro@seed.emotionflix.com', username: 'hiro_s', password: 'seed123!', bio: 'I am drawn to the quiet fear that follows me home and makes familiar rooms feel unfamiliar.' },
  { email: 'chloe@seed.emotionflix.com', username: 'chloe_d', password: 'seed123!', bio: 'I look for wonder, playfulness, and the kind of warmth that makes the world feel briefly repairable.' },
  { email: 'devon@seed.emotionflix.com', username: 'devon_m', password: 'seed123!', bio: 'I like being frightened, but I remember the films that uncover grief or loneliness beneath the fear.' },
  { email: 'ananya@seed.emotionflix.com', username: 'ananya_sen', password: 'seed123!', bio: 'I stay with films that make injustice personal and turn my anger into attention rather than distance.' },
  { email: 'lucas@seed.emotionflix.com', username: 'lucas_v', password: 'seed123!', bio: 'I chase the strange little emotional turns that make me laugh, ache, and question my first response.' },
  { email: 'sarah@seed.emotionflix.com', username: 'sarah_m', password: 'seed123!', bio: 'I remember films through gestures, rooms, and the bittersweet feeling of people trying to reach each other.' },
  { email: 'tariq@seed.emotionflix.com', username: 'tariq_a', password: 'seed123!', bio: 'I need films that leave enough quiet for my own memories to enter and change what I am watching.' },
  { email: 'rachel@seed.emotionflix.com', username: 'rachel_g', password: 'seed123!', bio: 'I am interested in the feelings people hide from family, friends, and sometimes from themselves.' },
] as const;

export const SEED_EMAILS = SEED_USERS.map(user => user.email);

const DIARY_SEED_ENTRIES: Record<string, SeedEntry[]> = {
  demo: [
    post('eternal-sunshine', 'Eternal Sunshine of the Spotless Mind', 2004, 'I felt the ache of loving someone even when love cannot save either of you from repeating old wounds.', 'public', emos(0.08, 0.08, 0.72, 0.03, 0.03, 0.02, 0.12)),
    post('inception', 'Inception', 2010, 'I left with a rush of wonder and a small fear that certainty might be more fragile than I pretend.', 'private', emos(0.12, 0.06, 0.03, 0.02, 0.12, 0.02, 0.72)),
    post('spirited-away', 'Spirited Away', 2001, 'I felt brave in a childlike way, as if kindness could still guide me through a world I did not understand.', 'public', emos(0.08, 0.34, 0.04, 0.01, 0.05, 0.01, 0.71)),
    post('before-sunrise', 'Before Sunrise', 1995, 'I felt hopeful about the rare moments when another person seems to understand the exact shape of your loneliness.', 'private', emos(0.12, 0.58, 0.22, 0.01, 0.02, 0.01, 0.18)),
    post('whiplash', 'Whiplash', 2014, 'I felt angry at how easily cruelty can disguise itself as belief in someone, and unsettled by my own excitement.', 'public', emos(0.04, 0.03, 0.09, 0.74, 0.18, 0.12, 0.06)),
    post('past-lives', 'Past Lives', 2023, 'I mourned the person I might have become somewhere else, with someone who remembers an earlier version of me.', 'private', emos(0.18, 0.08, 0.76, 0.01, 0.03, 0.01, 0.08)),
    post('cure', 'Cure', 1997, 'I felt a quiet dread about how little it might take for an ordinary person to become unrecognizable.', 'private', emos(0.28, 0.01, 0.04, 0.05, 0.74, 0.18, 0.03)),
    post('parasite', 'Parasite', 2019, 'I felt ashamed of how quickly comfort can make suffering invisible, then angry when that distance became unbearable.', 'public', emos(0.04, 0.02, 0.16, 0.68, 0.12, 0.42, 0.08)),
    post('wall-e', 'WALL-E', 2008, 'I felt tenderness for the need to be noticed, and hope that care can survive even after everything else is neglected.', 'private', emos(0.08, 0.62, 0.22, 0.01, 0.02, 0.01, 0.24)),
    post('godfather', 'The Godfather', 1972, 'I felt the sadness of watching belonging turn into a cage while everyone keeps calling it family.', 'private', emos(0.42, 0.02, 0.54, 0.18, 0.06, 0.08, 0.02)),
    post('hereditary', 'Hereditary', 2018, 'I felt trapped inside a family grief so large that every attempt to escape it only made it more frightening.', 'private', emos(0.03, 0.01, 0.34, 0.08, 0.78, 0.12, 0.04)),
    post('get-out', 'Get Out', 2017, 'I felt the exhausting fear of recognizing danger while everyone around you insists that you are imagining it.', 'public', emos(0.03, 0.01, 0.06, 0.52, 0.71, 0.18, 0.08)),
    post('2001', '2001: A Space Odyssey', 1968, 'I felt wonderfully small, almost relieved that the universe does not owe me an explanation.', 'private', emos(0.46, 0.05, 0.02, 0.01, 0.08, 0.01, 0.74)),
    post('la-la-land', 'La La Land', 2016, 'I felt grateful for a love that mattered even though it was not the life either person finally chose.', 'private', emos(0.08, 0.32, 0.68, 0.01, 0.02, 0.01, 0.12)),
    post('schindlers-list', 'Schindler\'s List', 1993, 'I felt grief become anger when individual lives were treated as numbers, and I did not want that anger softened.', 'private', emos(0.02, 0.01, 0.78, 0.56, 0.08, 0.22, 0.02)),
    post('toy-story', 'Toy Story', 1995, 'I felt the old childhood fear of being replaced, followed by the relief of discovering that affection can expand.', 'private', emos(0.07, 0.68, 0.18, 0.03, 0.12, 0.01, 0.18)),
  ],
  clara_valdez: [
    post('eternal-sunshine', 'Eternal Sunshine of the Spotless Mind', 2004, 'I felt seen by the wish to erase pain and by the quieter truth that losing the pain would also erase part of me.', 'public', emos(0.09, 0.06, 0.74, 0.02, 0.04, 0.02, 0.11)),
    post('before-sunrise', 'Before Sunrise', 1995, 'I felt the fragile joy of being fully awake with another person while knowing the night could not last.', 'public', emos(0.09, 0.62, 0.21, 0.01, 0.02, 0.01, 0.19)),
    post('past-lives', 'Past Lives', 2023, 'I felt homesick for choices I never made and unexpectedly grateful for the life that was actually beside me.', 'public', emos(0.17, 0.12, 0.73, 0.01, 0.02, 0.01, 0.09)),
    post('moonlight', 'Moonlight', 2016, 'I felt the loneliness of needing tenderness before I had the language or safety to ask for it.', 'public', emos(0.11, 0.05, 0.78, 0.05, 0.11, 0.02, 0.04)),
    post('portrait', 'Portrait of a Lady on Fire', 2019, 'I felt how attention can become a form of love, and how memory keeps looking after separation.', 'public', emos(0.12, 0.22, 0.67, 0.02, 0.03, 0.01, 0.13)),
    post('aftersun', 'Aftersun', 2022, 'I felt my adult understanding arrive too late to comfort the parent I remembered from childhood.', 'public', emos(0.14, 0.03, 0.82, 0.04, 0.05, 0.01, 0.05)),
    post('lost-in-translation', 'Lost in Translation', 2003, 'I felt less alone in the strange intimacy of being understood by someone who cannot stay.', 'private', emos(0.18, 0.24, 0.62, 0.01, 0.02, 0.01, 0.08)),
    post('in-the-mood', 'In the Mood for Love', 2000, 'I felt the weight of every feeling left unspoken and every life protected by that silence.', 'private', emos(0.28, 0.04, 0.71, 0.02, 0.03, 0.01, 0.07)),
    post('schindlers-list', 'Schindler\'s List', 1993, 'I felt overwhelmed by the distance between one person choosing care and a system choosing cruelty.', 'private', emos(0.03, 0.01, 0.76, 0.49, 0.12, 0.25, 0.02)),
  ],
  marcus_k: [
    post('inception', 'Inception', 2010, 'I felt exhilarated by the possibility that my deepest certainty could be something another person planted there.', 'public', emos(0.11, 0.08, 0.03, 0.02, 0.12, 0.02, 0.73)),
    post('2001', '2001: A Space Odyssey', 1968, 'I felt awe without needing to solve it, which was strangely peaceful for someone who always wants an answer.', 'public', emos(0.42, 0.04, 0.02, 0.01, 0.09, 0.01, 0.76)),
    post('eternal-sunshine', 'Eternal Sunshine of the Spotless Mind', 2004, 'I felt frustrated by the choice to return to pain, then recognized how often I make that same choice in smaller ways.', 'public', emos(0.09, 0.03, 0.38, 0.45, 0.05, 0.04, 0.18)),
    post('matrix', 'The Matrix', 1999, 'I felt the thrill of realizing that obedience can feel comfortable right up until the moment you see the cage.', 'public', emos(0.08, 0.18, 0.02, 0.28, 0.12, 0.04, 0.68)),
    post('blade-runner-2049', 'Blade Runner 2049', 2017, 'I felt lonely for a person trying to prove he was real when being loved would have been proof enough.', 'public', emos(0.24, 0.04, 0.69, 0.02, 0.08, 0.02, 0.16)),
    post('arrival', 'Arrival', 2016, 'I felt devastated and grateful that knowing an ending would not stop me from choosing the love before it.', 'public', emos(0.12, 0.13, 0.76, 0.01, 0.03, 0.01, 0.31)),
    post('ex-machina', 'Ex Machina', 2015, 'I felt uneasy about how quickly curiosity becomes control when another mind is treated as an object.', 'private', emos(0.17, 0.01, 0.04, 0.26, 0.35, 0.48, 0.09)),
    post('memento', 'Memento', 2000, 'I felt frightened by how easily I could build an identity around the story I most need to believe.', 'private', emos(0.24, 0.01, 0.09, 0.12, 0.62, 0.12, 0.08)),
    post('spirited-away', 'Spirited Away', 2001, 'I felt surprised by how much courage can look like simple patience and kindness rather than certainty.', 'private', emos(0.09, 0.41, 0.03, 0.01, 0.04, 0.01, 0.68)),
  ],
  elena_r: [
    post('before-sunrise-first', 'Before Sunrise', 1995, 'I felt the dizzy hope that one conversation could divide my life into before and after.', 'public', emos(0.08, 0.64, 0.19, 0.01, 0.02, 0.01, 0.21)),
    post('past-lives', 'Past Lives', 2023, 'I felt sorrow for the life that never happened, but I also felt tenderness toward the life that did.', 'public', emos(0.16, 0.14, 0.72, 0.01, 0.02, 0.01, 0.08)),
    post('la-la-land', 'La La Land', 2016, 'I felt proud of two people for becoming themselves and sad that becoming required them to separate.', 'public', emos(0.08, 0.31, 0.69, 0.01, 0.02, 0.01, 0.11)),
    post('before-sunset', 'Before Sunset', 2004, 'I felt the urgency of years collapsing into one afternoon and the terror of wasting another chance.', 'public', emos(0.12, 0.39, 0.51, 0.02, 0.16, 0.01, 0.14)),
    post('amelie', 'Amélie', 2001, 'I felt lighter about the small private ways people can care for strangers without being thanked.', 'public', emos(0.07, 0.74, 0.04, 0.01, 0.02, 0.01, 0.28)),
    post('aftersun', 'Aftersun', 2022, 'I felt the helpless love of looking backward and finally understanding what a smile was hiding.', 'public', emos(0.12, 0.03, 0.84, 0.03, 0.07, 0.01, 0.04)),
    post('titanic', 'Titanic', 1997, 'I felt young enough to believe a brief love could permanently change the size of a life.', 'private', emos(0.07, 0.42, 0.51, 0.02, 0.04, 0.01, 0.16)),
    post('eternal-sunshine', 'Eternal Sunshine of the Spotless Mind', 2004, 'I felt protective of the memories that hurt me because they still belong to who I became.', 'private', emos(0.11, 0.05, 0.75, 0.02, 0.03, 0.01, 0.09)),
    post('before-sunrise-repeat', 'Before Sunrise', 1995, 'I felt less romantic the second time and more grateful for how rarely two people truly listen.', 'private', emos(0.24, 0.46, 0.22, 0.01, 0.02, 0.01, 0.12)),
  ],
  hiro_s: [
    post('cure', 'Cure', 1997, 'I felt a cold fear that identity might be thinner than I need it to be, and that thought followed me into every quiet room.', 'public', emos(0.29, 0.01, 0.04, 0.06, 0.76, 0.19, 0.03), { assetPath: '/social/hiro-after-cure.webp', altText: 'Hiro sitting quietly after watching Cure' }),
    post('get-out', 'Get Out', 2017, 'I felt the panic of knowing something is wrong while politeness keeps closing every possible exit.', 'public', emos(0.04, 0.01, 0.04, 0.39, 0.78, 0.21, 0.06)),
    post('inception', 'Inception', 2010, 'I felt less wonder than dread because a mind that can be entered can never feel entirely private again.', 'public', emos(0.19, 0.02, 0.03, 0.04, 0.66, 0.11, 0.24)),
    post('silence-lambs', 'The Silence of the Lambs', 1991, 'I felt the pressure of being watched and judged before being allowed to prove I belonged in the room.', 'public', emos(0.06, 0.01, 0.08, 0.27, 0.72, 0.14, 0.04)),
    post('psycho', 'Psycho', 1960, 'I felt uneasy about how quickly sympathy can pull me toward someone I should fear.', 'public', emos(0.14, 0.01, 0.04, 0.03, 0.71, 0.26, 0.08)),
    post('shining', 'The Shining', 1980, 'I felt trapped in the dread of a home becoming the place where danger knows me best.', 'public', emos(0.08, 0.01, 0.11, 0.09, 0.79, 0.13, 0.03)),
    post('memento', 'Memento', 2000, 'I felt suspicious of every certainty I use to keep moving when the truth would stop me.', 'private', emos(0.26, 0.01, 0.08, 0.12, 0.58, 0.15, 0.07)),
    post('alien', 'Alien', 1979, 'I felt the ancient fear of being hunted somewhere too empty for anyone to hear me.', 'private', emos(0.05, 0.01, 0.04, 0.04, 0.82, 0.17, 0.06)),
    post('past-lives', 'Past Lives', 2023, 'I felt calm rather than heartbroken, as if accepting an unlived life could finally let the present breathe.', 'private', emos(0.65, 0.16, 0.18, 0.01, 0.01, 0.01, 0.05)),
  ],
  chloe_d: [
    post('spirited-away', 'Spirited Away', 2001, 'I felt the joy of discovering that being gentle does not mean being helpless.', 'public', emos(0.07, 0.58, 0.03, 0.01, 0.03, 0.01, 0.64)),
    post('wall-e', 'WALL-E', 2008, 'I felt hopeful that one small act of attention could wake people from years of forgetting how to live.', 'public', emos(0.08, 0.69, 0.14, 0.01, 0.02, 0.01, 0.28)),
    post('la-la-land', 'La La Land', 2016, 'I felt more joy than sadness because I could see love continuing inside the people it changed.', 'public', emos(0.08, 0.63, 0.29, 0.01, 0.02, 0.01, 0.12)),
    post('toy-story', 'Toy Story', 1995, 'I felt comforted by the idea that jealousy can soften once we stop treating affection as scarce.', 'public', emos(0.06, 0.72, 0.12, 0.03, 0.05, 0.01, 0.18)),
    post('finding-nemo', 'Finding Nemo', 2003, 'I felt the relief of watching love loosen its grip enough to become trust.', 'public', emos(0.07, 0.66, 0.16, 0.01, 0.06, 0.01, 0.14)),
    post('coco', 'Coco', 2017, 'I felt close to everyone I have lost when remembering became a form of keeping them present.', 'public', emos(0.06, 0.48, 0.52, 0.01, 0.02, 0.01, 0.22)),
    post('ratatouille', 'Ratatouille', 2007, 'I felt encouraged that joy and belonging can begin with one memory of being cared for.', 'private', emos(0.08, 0.73, 0.11, 0.01, 0.02, 0.01, 0.18)),
    post('amelie', 'Amélie', 2001, 'I felt playful and a little braver about turning private kindness into actual connection.', 'private', emos(0.06, 0.76, 0.03, 0.01, 0.02, 0.01, 0.25)),
    post('hereditary', 'Hereditary', 2018, 'I felt sadder than scared because grief had made everyone unreachable before anything else arrived.', 'private', emos(0.04, 0.01, 0.71, 0.08, 0.43, 0.09, 0.03)),
  ],
  devon_m: [
    post('past-lives', 'Past Lives', 2023, 'I felt exposed by how quietly grief can sit beside a good life without asking that life to disappear.', 'public', emos(0.16, 0.08, 0.77, 0.01, 0.03, 0.01, 0.06), { assetPath: '/social/devon-after-past-lives.webp', altText: 'Devon reflecting after watching Past Lives' }),
    post('hereditary', 'Hereditary', 2018, 'I felt grief curdle into fear because no one in that family could reach the others before it was too late.', 'public', emos(0.03, 0.01, 0.46, 0.08, 0.77, 0.14, 0.04)),
    post('get-out', 'Get Out', 2017, 'I felt angry at every smile that asked the frightened person to doubt what he already knew.', 'public', emos(0.04, 0.01, 0.05, 0.61, 0.68, 0.17, 0.06)),
    post('cure', 'Cure', 1997, 'I felt unsettled by the possibility that violence does not always announce itself with rage.', 'public', emos(0.27, 0.01, 0.04, 0.11, 0.74, 0.25, 0.03)),
    post('shining', 'The Shining', 1980, 'I felt the terror of being disbelieved inside the place where I should have been safest.', 'public', emos(0.06, 0.01, 0.13, 0.16, 0.79, 0.11, 0.03)),
    post('alien', 'Alien', 1979, 'I felt fiercely alert, as if survival depended on noticing what everyone else dismissed.', 'public', emos(0.07, 0.01, 0.03, 0.24, 0.73, 0.16, 0.12)),
    post('psycho', 'Psycho', 1960, 'I felt sorry for a lonely person and disturbed by how that sympathy was used against me.', 'private', emos(0.13, 0.01, 0.26, 0.03, 0.61, 0.31, 0.07)),
    post('toy-story', 'Toy Story', 1995, 'I felt unexpectedly tender toward the fear that being replaced means becoming unlovable.', 'private', emos(0.08, 0.52, 0.27, 0.03, 0.13, 0.01, 0.12)),
    post('eternal-sunshine', 'Eternal Sunshine of the Spotless Mind', 2004, 'I felt frightened by how eagerly I might surrender painful memories just to avoid being vulnerable again.', 'private', emos(0.08, 0.02, 0.49, 0.05, 0.58, 0.08, 0.06)),
  ],
  ananya_sen: [
    post('whiplash', 'Whiplash', 2014, 'I felt furious that harm was treated as the price of greatness, and I kept thinking about everyone taught to accept that bargain.', 'public', emos(0.03, 0.01, 0.12, 0.81, 0.16, 0.18, 0.03), { assetPath: '/social/ananya-after-whiplash.webp', altText: 'Ananya reacting after watching Whiplash' }),
    post('parasite', 'Parasite', 2019, 'I felt anger and shame at how easily one family could remain comfortable above another family\'s fear.', 'public', emos(0.03, 0.01, 0.16, 0.73, 0.11, 0.39, 0.05)),
    post('before-sunrise', 'Before Sunrise', 1995, 'I felt impatient with the freedom they took for granted, then softened when their loneliness became harder to dismiss.', 'public', emos(0.13, 0.19, 0.18, 0.48, 0.03, 0.07, 0.08)),
    post('schindlers-list', 'Schindler\'s List', 1993, 'I felt grief and rage at every ordinary process used to make cruelty feel administrative.', 'public', emos(0.02, 0.01, 0.72, 0.69, 0.09, 0.27, 0.02)),
    post('saving-private-ryan', 'Saving Private Ryan', 1998, 'I felt exhausted by the human cost hidden inside words like duty, victory, and sacrifice.', 'public', emos(0.05, 0.01, 0.67, 0.48, 0.29, 0.14, 0.03)),
    post('dunkirk-first', 'Dunkirk', 2017, 'I felt the panic of time narrowing until survival became the only thought anyone could hold.', 'public', emos(0.09, 0.01, 0.09, 0.18, 0.76, 0.04, 0.08)),
    post('dunkirk-repeat', 'Dunkirk', 2017, 'I felt less afraid the second time and more aware of how rescue depends on strangers choosing responsibility.', 'private', emos(0.26, 0.12, 0.22, 0.08, 0.38, 0.02, 0.09)),
    post('spirited-away', 'Spirited Away', 2001, 'I felt hope in a young person refusing to let a frightening world decide what kindness should cost.', 'private', emos(0.07, 0.49, 0.05, 0.03, 0.05, 0.01, 0.59)),
    post('godfather', 'The Godfather', 1972, 'I felt sad that loyalty became an excuse for men to keep passing violence down as inheritance.', 'private', emos(0.26, 0.01, 0.58, 0.45, 0.05, 0.13, 0.02)),
  ],
  lucas_v: [
    post('eternal-sunshine', 'Eternal Sunshine of the Spotless Mind', 2004, 'I felt the strange comfort of accepting that love can be real even when it is clumsy and temporary.', 'public', emos(0.08, 0.17, 0.66, 0.02, 0.03, 0.01, 0.22)),
    post('parasite', 'Parasite', 2019, 'I felt amused until the laughter caught in my throat and turned into embarrassment about what I had enjoyed.', 'public', emos(0.05, 0.26, 0.14, 0.41, 0.12, 0.36, 0.18)),
    post('wall-e', 'WALL-E', 2008, 'I felt moved by a lonely little being who kept caring without any guarantee that care would be returned.', 'public', emos(0.09, 0.59, 0.28, 0.01, 0.02, 0.01, 0.22)),
    post('grand-budapest', 'The Grand Budapest Hotel', 2014, 'I felt joy in the bright surface and sadness for a vanished world the storyteller still needed to protect.', 'public', emos(0.11, 0.56, 0.38, 0.01, 0.02, 0.01, 0.19)),
    post('memento', 'Memento', 2000, 'I felt trapped by the thought that a purpose can become more important than whether it is true.', 'public', emos(0.28, 0.01, 0.12, 0.16, 0.53, 0.13, 0.08)),
    post('knives-out', 'Knives Out', 2019, 'I felt delighted by kindness becoming a strength instead of an invitation to be used.', 'public', emos(0.08, 0.68, 0.03, 0.03, 0.04, 0.02, 0.28)),
    post('get-out', 'Get Out', 2017, 'I felt the sick recognition of a room where everyone is friendly and no one sees you as fully human.', 'private', emos(0.04, 0.01, 0.08, 0.51, 0.57, 0.36, 0.05)),
    post('titanic', 'Titanic', 1997, 'I felt distant from the romance but deeply sad about how class decides whose fear is heard first.', 'private', emos(0.14, 0.03, 0.63, 0.36, 0.11, 0.16, 0.04)),
    post('whiplash', 'Whiplash', 2014, 'I felt energized and then guilty that someone else\'s pain had been arranged to make me cheer.', 'private', emos(0.04, 0.14, 0.18, 0.55, 0.11, 0.18, 0.16)),
  ],
  sarah_m: [
    post('la-la-land', 'La La Land', 2016, 'I felt the sweetness of seeing what might have been without asking the present to become a regret.', 'public', emos(0.09, 0.37, 0.65, 0.01, 0.02, 0.01, 0.12)),
    post('godfather', 'The Godfather', 1972, 'I felt sorrow for a person disappearing into the role his family had prepared for him.', 'public', emos(0.39, 0.01, 0.58, 0.21, 0.06, 0.08, 0.02)),
    post('before-sunrise', 'Before Sunrise', 1995, 'I felt young again in the hope that being listened to can make a stranger feel necessary.', 'public', emos(0.09, 0.59, 0.23, 0.01, 0.02, 0.01, 0.18)),
    post('amelie', 'Amélie', 2001, 'I felt amused by private kindness and nudged to stop hiding behind it when I want closeness.', 'public', emos(0.08, 0.71, 0.04, 0.01, 0.03, 0.01, 0.23)),
    post('grand-budapest', 'The Grand Budapest Hotel', 2014, 'I felt comfort in someone preserving grace even after the world around him stopped rewarding it.', 'public', emos(0.16, 0.57, 0.28, 0.01, 0.02, 0.01, 0.14)),
    post('titanic', 'Titanic', 1997, 'I felt the reckless hope of choosing one vivid day over a lifetime arranged by other people.', 'public', emos(0.07, 0.48, 0.43, 0.03, 0.07, 0.01, 0.18)),
    post('before-sunset', 'Before Sunset', 2004, 'I felt every polite sentence holding back years of longing and the fear of asking for too much.', 'private', emos(0.12, 0.28, 0.59, 0.02, 0.15, 0.01, 0.08)),
    post('wall-e', 'WALL-E', 2008, 'I felt hopeful that devotion can remain gentle even when it has been lonely for a long time.', 'private', emos(0.08, 0.64, 0.21, 0.01, 0.02, 0.01, 0.17)),
    post('hereditary', 'Hereditary', 2018, 'I felt the despair of a family speaking from separate rooms even when they sat at the same table.', 'private', emos(0.04, 0.01, 0.66, 0.17, 0.49, 0.09, 0.03)),
  ],
  tariq_a: [
    post('2001', '2001: A Space Odyssey', 1968, 'I felt still enough to notice how comforting it can be not to understand everything.', 'public', emos(0.63, 0.03, 0.02, 0.01, 0.05, 0.01, 0.62)),
    post('cure', 'Cure', 1997, 'I felt dread enter slowly, which made it harder to separate the film from my own thoughts afterward.', 'public', emos(0.34, 0.01, 0.05, 0.04, 0.71, 0.16, 0.03)),
    post('before-sunrise', 'Before Sunrise', 1995, 'I felt peaceful listening to two people make time for thoughts that usually pass without witness.', 'public', emos(0.43, 0.37, 0.18, 0.01, 0.01, 0.01, 0.09)),
    post('shining', 'The Shining', 1980, 'I felt the silence of a large place pressing against a family that was already coming apart.', 'public', emos(0.31, 0.01, 0.17, 0.08, 0.65, 0.08, 0.03)),
    post('godfather', 'The Godfather', 1972, 'I felt the quiet sadness of someone mistaking control for the ability to keep his family close.', 'public', emos(0.48, 0.01, 0.52, 0.14, 0.04, 0.06, 0.02)),
    post('matrix', 'The Matrix', 1999, 'I felt awake to all the small routines I obey simply because they were waiting when I arrived.', 'public', emos(0.22, 0.08, 0.03, 0.21, 0.11, 0.03, 0.59)),
    post('dunkirk', 'Dunkirk', 2017, 'I felt time as a physical pressure and relief whenever another person chose not to look away.', 'private', emos(0.27, 0.02, 0.13, 0.08, 0.61, 0.03, 0.07)),
    post('1917', '1917', 2019, 'I felt exhausted by the distance one person can be asked to cross for lives he will never know.', 'private', emos(0.31, 0.01, 0.43, 0.14, 0.37, 0.04, 0.04)),
    post('before-sunset', 'Before Sunset', 2004, 'I felt the quiet panic of a clock moving while two people tried to say what years had hidden.', 'private', emos(0.34, 0.17, 0.46, 0.02, 0.14, 0.01, 0.06)),
  ],
  rachel_g: [
    post('whiplash', 'Whiplash', 2014, 'I felt angry at the promise that suffering would become worthwhile if it produced something impressive enough.', 'public', emos(0.04, 0.01, 0.11, 0.79, 0.14, 0.19, 0.03)),
    post('parasite', 'Parasite', 2019, 'I felt the humiliation of being reduced to something another person could smell but refused to understand.', 'public', emos(0.04, 0.01, 0.31, 0.67, 0.09, 0.42, 0.04)),
    post('hereditary', 'Hereditary', 2018, 'I felt grief turn monstrous when every person in the family needed comfort from someone equally broken.', 'public', emos(0.03, 0.01, 0.54, 0.12, 0.68, 0.13, 0.03)),
    post('saving-private-ryan', 'Saving Private Ryan', 1998, 'I felt sorrow for the people asked to carry an idea of honor heavier than their own lives.', 'public', emos(0.05, 0.01, 0.72, 0.39, 0.27, 0.11, 0.02)),
    post('finding-nemo', 'Finding Nemo', 2003, 'I felt the fear of loving someone so much that protection begins to keep them from living.', 'public', emos(0.06, 0.47, 0.25, 0.03, 0.36, 0.01, 0.08)),
    post('godfather', 'The Godfather', 1972, 'I felt betrayed by every family promise that really meant silence, obedience, and fear.', 'public', emos(0.21, 0.01, 0.46, 0.57, 0.08, 0.16, 0.02)),
    post('before-sunset', 'Before Sunset', 2004, 'I felt the frustration of watching honesty arrive only when there was almost no time left for it.', 'private', emos(0.12, 0.14, 0.59, 0.38, 0.08, 0.03, 0.05)),
    post('dark-knight', 'The Dark Knight', 2008, 'I felt exhausted by the idea that proving people are cruel can become its own excuse for cruelty.', 'private', emos(0.09, 0.01, 0.19, 0.58, 0.31, 0.17, 0.04)),
    post('eternal-sunshine', 'Eternal Sunshine of the Spotless Mind', 2004, 'I felt the old temptation to call a painful pattern fate instead of admitting that I could choose differently.', 'private', emos(0.15, 0.03, 0.61, 0.26, 0.08, 0.05, 0.05)),
  ],
};

const SAVED_FILMS: Record<string, { title: string; year: number }[]> = Object.fromEntries(
  Object.entries(DIARY_SEED_ENTRIES).map(([username, entries]) => [
    username,
    entries.slice(username === 'demo' ? 0 : 3, username === 'demo' ? 8 : 7).map(entry => ({ title: entry.title, year: entry.year })),
  ]),
);

const FOLLOW_PLAN = [
  ['demo', 'clara_valdez'], ['demo', 'marcus_k'], ['demo', 'elena_r'],
  ['clara_valdez', 'elena_r'], ['clara_valdez', 'ananya_sen'],
  ['marcus_k', 'hiro_s'], ['marcus_k', 'chloe_d'], ['marcus_k', 'lucas_v'],
  ['elena_r', 'clara_valdez'], ['elena_r', 'chloe_d'],
  ['hiro_s', 'devon_m'],
  ['chloe_d', 'marcus_k'], ['chloe_d', 'lucas_v'],
  ['devon_m', 'hiro_s'], ['devon_m', 'lucas_v'],
  ['ananya_sen', 'clara_valdez'], ['ananya_sen', 'elena_r'], ['ananya_sen', 'lucas_v'],
  ['lucas_v', 'chloe_d'], ['lucas_v', 'devon_m'],
  ['sarah_m', 'elena_r'], ['sarah_m', 'chloe_d'],
  ['tariq_a', 'clara_valdez'], ['tariq_a', 'ananya_sen'],
  ['rachel_g', 'ananya_sen'], ['rachel_g', 'tariq_a'],
] as const;

const ensureSocialSchema = async (client: ConnectedDatabaseClient) => {
  await client.query('ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS seed_key VARCHAR(160)');
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_diary_entries_seed_key ON diary_entries(seed_key) WHERE seed_key IS NOT NULL');
  await client.query(`
    CREATE TABLE IF NOT EXISTS entry_media (
      entry_id BIGINT NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
      kind VARCHAR(24) NOT NULL CHECK (kind IN ('expression_photo')),
      asset_path TEXT NOT NULL,
      alt_text VARCHAR(240) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entry_id, kind)
    )
  `);
  await client.query('ALTER TABLE entry_media ALTER COLUMN asset_path TYPE TEXT');
};

const resolveMovieByTitleAndYear = async (client: ConnectedDatabaseClient, title: string, year: number) => {
  const existing = await client.query(
    'SELECT id, tmdb_data FROM movies WHERE LOWER(title) = LOWER($1) AND EXTRACT(YEAR FROM release_date) = $2 ORDER BY id LIMIT 1',
    [title, year],
  );
  if (existing.rowCount && existing.rows[0].tmdb_data) return existing.rows[0].tmdb_data;

  const search = await axios.get<{ results: Array<{ id: number; title: string; release_date?: string }> }>(`${TMDB_BASE_URL}/search/movie`, {
    params: { api_key: TMDB_API_KEY, query: title, primary_release_year: year },
  });
  const results = search.data.results || [];
  const exact = results.filter(movie => movie.title.toLowerCase() === title.toLowerCase()
    && Number(movie.release_date?.slice(0, 4)) === year);
  const match = exact.length === 1 ? exact[0] : results.find(movie => Number(movie.release_date?.slice(0, 4)) === year);
  if (!match) throw new Error(`No unambiguous TMDB result for "${title}" (${year})`);

  const detailsResponse = await axios.get<Record<string, any>>(`${TMDB_BASE_URL}/movie/${match.id}`, { params: { api_key: TMDB_API_KEY } });
  const details = detailsResponse.data;
  const genreIds = details.genre_ids?.length ? details.genre_ids : details.genres?.map((genre: { id: number }) => genre.id) || [];
  await client.query(
    `INSERT INTO movies (id, title, overview, release_date, poster_path, backdrop_path, vote_average, vote_count, popularity, runtime, tmdb_data)
     VALUES ($1,$2,$3,NULLIF($4,'')::date,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, overview = EXCLUDED.overview, release_date = EXCLUDED.release_date,
       poster_path = EXCLUDED.poster_path, backdrop_path = EXCLUDED.backdrop_path,
       vote_average = EXCLUDED.vote_average, vote_count = EXCLUDED.vote_count,
       popularity = EXCLUDED.popularity, runtime = EXCLUDED.runtime,
       tmdb_data = EXCLUDED.tmdb_data, last_updated = CURRENT_TIMESTAMP`,
    [details.id, details.title, details.overview || '', details.release_date || '', details.poster_path,
      details.backdrop_path, details.vote_average || 0, details.vote_count || 0, details.popularity || 0,
      details.runtime || null, JSON.stringify({ ...details, genre_ids: genreIds })],
  );
  for (const genreId of genreIds) {
    await client.query(
      'INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [details.id, genreId],
    );
  }
  return { ...details, genre_ids: genreIds };
};

const seedDate = (position: number) => {
  const date = new Date(`${SEED_REFERENCE_DATE}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - (5 + ((position * 37) % 520)));
  return date.toISOString().slice(0, 10);
};

const seedTimestamp = (position: number) => {
  const date = seedDate(position);
  const hour = 8 + (position * 7) % 12;
  const minute = (position * 17) % 60;
  return `${date} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
};

const stableOrder = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const seed = async () => {
  if (!TMDB_API_KEY) throw new Error('TMDB_API_KEY is required to seed film metadata.');
  await initializeDatabase();
  const client = await pool.connect();
  try {
    console.log('Starting social seed transaction...');
    await client.query('BEGIN');
    await ensureSocialSchema(client);

    const usernameToId = new Map<string, number>();
    const emailToId = new Map<string, number>();
    for (const user of SEED_USERS) {
      const existing = await client.query(
        'SELECT id, username, password_hash, bio FROM users WHERE email = $1',
        [user.email],
      );
      let id: number;
      if (existing.rowCount) {
        const current = existing.rows[0];
        const passwordMatches = await bcrypt.compare(user.password, current.password_hash);
        if (current.username !== user.username || current.bio !== user.bio || !passwordMatches) {
          const passwordHash = passwordMatches ? current.password_hash : await bcrypt.hash(user.password, 12);
          const updated = await client.query(
            `UPDATE users SET username = $2, password_hash = $3, bio = $4, updated_at = CURRENT_TIMESTAMP
             WHERE email = $1 RETURNING id`,
            [user.email, user.username, passwordHash, user.bio],
          );
          id = Number(updated.rows[0].id);
        } else {
          id = Number(current.id);
        }
      } else {
        const passwordHash = await bcrypt.hash(user.password, 12);
        const inserted = await client.query(
          `INSERT INTO users (email, username, password_hash, bio)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [user.email, user.username, passwordHash, user.bio],
        );
        id = Number(inserted.rows[0].id);
      }
      usernameToId.set(user.username, id);
      emailToId.set(user.email, id);
    }

    const allPlans = Object.entries(DIARY_SEED_ENTRIES)
      .flatMap(([username, entries]) => entries.map(entry => ({ username, ...entry })))
      .sort((left, right) => stableOrder(`${left.username}:${left.key}`) - stableOrder(`${right.username}:${right.key}`));

    const movieCache = new Map<string, { id: number }>();
    const moviePlans = new Map<string, { title: string; year: number }>();
    allPlans.forEach(entry => moviePlans.set(`${entry.title}|||${entry.year}`, entry));
    Object.values(SAVED_FILMS).flat().forEach(entry => moviePlans.set(`${entry.title}|||${entry.year}`, entry));
    for (const [movieKey, movie] of moviePlans) {
      movieCache.set(movieKey, await resolveMovieByTitleAndYear(client, movie.title, movie.year));
    }

    const publicEntryIds: number[] = [];
    const activeSeedKeys: string[] = [];
    for (const [username, entries] of Object.entries(DIARY_SEED_ENTRIES)) {
      const userId = usernameToId.get(username);
      if (!userId) throw new Error(`Missing seed user ${username}`);
      const existing = await client.query(
        `SELECT id, movie_id, seed_key FROM diary_entries
         WHERE user_id = $1
         ORDER BY id`,
        [userId],
      );
      const claimed = new Set<number>();

      for (const plan of entries) {
        const seedKey = `${SEED_PREFIX}${username}:${plan.key}`;
        activeSeedKeys.push(seedKey);
        const movie = movieCache.get(`${plan.title}|||${plan.year}`);
        if (!movie) throw new Error(`Missing resolved film ${plan.title} (${plan.year})`);
        const globalPosition = allPlans.findIndex(entry => entry.username === username && entry.key === plan.key);
        let row = existing.rows.find(item => item.seed_key === seedKey && !claimed.has(Number(item.id)));
        row ||= existing.rows.find(item => item.seed_key === null && Number(item.movie_id) === movie.id && !claimed.has(Number(item.id)));
        row ||= existing.rows.find(item => item.seed_key === null && !claimed.has(Number(item.id)));

        let entryId: number;
        if (row) {
          entryId = Number(row.id);
          claimed.add(entryId);
          await client.query(
            `UPDATE diary_entries SET
               seed_key = $2, movie_id = $3, watched_on = $4, rating = NULL,
               note = $5, visibility = $6,
               neutral = $7, happy = $8, sad = $9, angry = $10,
               fearful = $11, disgusted = $12, surprised = $13,
               capture_method = 'manual', confidence = 1
             WHERE id = $1`,
            [entryId, seedKey, movie.id, seedDate(globalPosition), plan.note, plan.visibility,
              plan.emotions.neutral, plan.emotions.happy, plan.emotions.sad, plan.emotions.angry,
              plan.emotions.fearful, plan.emotions.disgusted, plan.emotions.surprised],
          );
        } else {
          const inserted = await client.query(
            `INSERT INTO diary_entries (
               seed_key, user_id, movie_id, watched_on, rating, note, visibility,
               neutral, happy, sad, angry, fearful, disgusted, surprised,
               capture_method, confidence, created_at, updated_at
             ) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual',1,$14,$14)
             RETURNING id`,
            [seedKey, userId, movie.id, seedDate(globalPosition), plan.note, plan.visibility,
              plan.emotions.neutral, plan.emotions.happy, plan.emotions.sad, plan.emotions.angry,
              plan.emotions.fearful, plan.emotions.disgusted, plan.emotions.surprised, seedTimestamp(globalPosition)],
          );
          entryId = Number(inserted.rows[0].id);
        }

        if (plan.expressionPhoto) {
          await client.query(
            `INSERT INTO entry_media (entry_id, kind, asset_path, alt_text)
             VALUES ($1, 'expression_photo', $2, $3)
             ON CONFLICT (entry_id, kind) DO UPDATE SET
               asset_path = EXCLUDED.asset_path, alt_text = EXCLUDED.alt_text,
               updated_at = entry_media.updated_at`,
            [entryId, plan.expressionPhoto.assetPath, plan.expressionPhoto.altText],
          );
        } else {
          await client.query("DELETE FROM entry_media WHERE entry_id = $1 AND kind = 'expression_photo'", [entryId]);
        }
        if (plan.visibility === 'public') publicEntryIds.push(entryId);
      }

      await client.query(
        `UPDATE diary_entries SET visibility = 'private', rating = NULL, capture_method = 'manual', confidence = 1
         WHERE user_id = $1 AND (seed_key IS NULL OR (seed_key LIKE $2 AND NOT (seed_key = ANY($3::text[]))))`,
        [userId, `${SEED_PREFIX}${username}:%`, activeSeedKeys],
      );
    }

    for (const [username, films] of Object.entries(SAVED_FILMS)) {
      const userId = usernameToId.get(username);
      if (!userId) continue;
      for (const film of films) {
        const movie = movieCache.get(`${film.title}|||${film.year}`);
        if (!movie) continue;
        await client.query(
          `INSERT INTO saved_films (user_id, movie_id, created_at)
           VALUES ($1,$2,$3) ON CONFLICT (user_id, movie_id) DO NOTHING`,
          [userId, movie.id, `${SEED_REFERENCE_DATE} 12:00:00`],
        );
      }
    }

    for (const [follower, followed] of FOLLOW_PLAN) {
      const followerId = usernameToId.get(follower);
      const followedId = usernameToId.get(followed);
      if (!followerId || !followedId) throw new Error(`Invalid follow plan ${follower} -> ${followed}`);
      await client.query(
        `INSERT INTO follows (follower_id, followed_id, created_at)
         VALUES ($1,$2,$3) ON CONFLICT (follower_id, followed_id) DO NOTHING`,
        [followerId, followedId, `${SEED_REFERENCE_DATE} 12:00:00`],
      );
    }

    const seedUserIds = [...emailToId.values()];
    await client.query(
      `DELETE FROM entry_reactions
       WHERE user_id = ANY($1::int[])
         AND entry_id = ANY($2::bigint[])`,
      [seedUserIds, publicEntryIds],
    );
    await client.query(
      `DELETE FROM entry_reactions
       WHERE user_id = ANY($1::int[])
         AND entry_id IN (SELECT id FROM diary_entries WHERE visibility = 'private')`,
      [seedUserIds],
    );
    for (let index = 0; index < publicEntryIds.length; index += 1) {
      if (index % 10 >= 7) continue;
      const entryId = publicEntryIds[index];
      const author = await client.query('SELECT user_id FROM diary_entries WHERE id = $1', [entryId]);
      const possible = seedUserIds.filter(id => id !== Number(author.rows[0].user_id));
      const reactionTotal = 1 + stableOrder(String(entryId)) % 5;
      for (let offset = 0; offset < reactionTotal; offset += 1) {
        const reactorId = possible[(index * 3 + offset * 5) % possible.length];
        await client.query(
          `INSERT INTO entry_reactions (user_id, entry_id, created_at)
           VALUES ($1,$2,$3) ON CONFLICT (user_id, entry_id) DO NOTHING`,
          [reactorId, entryId, `${SEED_REFERENCE_DATE} 12:00:00`],
        );
      }
    }

    await client.query('COMMIT');

    const counts = await pool.query(
      `SELECT
         COUNT(DISTINCT de.user_id)::int AS accounts,
         COUNT(DISTINCT de.movie_id)::int AS films,
         COUNT(*)::int AS responses,
         COUNT(*) FILTER (WHERE de.visibility = 'public')::int AS public_posts,
         COUNT(em.entry_id)::int AS expression_photos,
         (SELECT COUNT(*)::int FROM saved_films WHERE user_id = ANY($1::int[])) AS saved_films,
         (SELECT COUNT(*)::int FROM follows WHERE follower_id = ANY($1::int[])) AS follows,
         (SELECT COUNT(*)::int FROM entry_reactions WHERE user_id = ANY($1::int[])) AS reactions
       FROM diary_entries de
       LEFT JOIN entry_media em ON em.entry_id = de.id AND em.kind = 'expression_photo'
       WHERE de.seed_key = ANY($2::text[])`,
      [seedUserIds, activeSeedKeys],
    );
    const result = counts.rows[0];
    console.log('\nSocial seed complete');
    console.log(`Accounts: ${result.accounts}`);
    console.log(`Films: ${result.films}`);
    console.log(`Responses: ${result.responses}`);
    console.log(`Public posts: ${result.public_posts}`);
    console.log(`Expression photos: ${result.expression_photos}`);
    console.log(`Saved films: ${result.saved_films}`);
    console.log(`Follows: ${result.follows}`);
    console.log(`Reactions: ${result.reactions}`);
    console.log('Run npm run seed:verify to verify the social seed contract.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  void seed()
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
