// Generates platform token files from design/tokens.json.
//   node scripts/build-tokens.mjs          write the files
//   node scripts/build-tokens.mjs --check  fail if a generated file is stale
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(path.join(root, 'design/tokens.json'), 'utf8'));
const check = process.argv.includes('--check');
const kebab = name => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const banner = 'Generated from design/tokens.json by scripts/build-tokens.mjs. Do not edit by hand.';

// ---- Web: CSS custom properties -------------------------------------------
const colorBlock = scheme => [
  ...Object.entries(tokens.color[scheme]).map(([name, value]) => `  --m-color-${kebab(name)}: ${value};`),
  ...Object.entries(tokens.feeling[scheme]).map(([name, value]) => `  --m-feeling-${name}: ${value};`),
].join('\n');
const typeLines = Object.entries(tokens.type).filter(([name]) => name !== 'note').flatMap(([name, role]) => [
  `  --m-type-${name}-size: ${role.size / 16}rem;`,
  `  --m-type-${name}-line: ${(role.line / role.size).toFixed(3)};`,
]);
const css = `/* ${banner} */
:root {
${colorBlock('light')}
${Object.entries(tokens.font).map(([name, value]) => `  --m-font-${name}: ${value};`).join('\n')}
${typeLines.join('\n')}
${Object.entries(tokens.space).map(([name, value]) => `  --m-space-${name}: ${value}px;`).join('\n')}
${Object.entries(tokens.radius).map(([name, value]) => `  --m-radius-${name}: ${value}px;`).join('\n')}
  --m-motion-fast: ${tokens.motion.fast}ms;
  --m-motion-base: ${tokens.motion.base}ms;
  --m-motion-slow: ${tokens.motion.slow}ms;
  --m-ease-out: ${tokens.motion.easeOut};
}

/* The screening-room theme is opt-in until every web surface has been checked in it. */
[data-theme='dark'] {
${colorBlock('dark')}
}
`;

// ---- iOS: Swift constants and asset-catalog colorsets ----------------------
const swift = `// ${banner}
import SwiftUI

enum MoodieTokens {
    enum Space {
${Object.entries(tokens.space).map(([name, value]) => `        static let s${name}: CGFloat = ${value}`).join('\n')}
    }
    enum Radius {
${Object.entries(tokens.radius).map(([name, value]) => `        static let ${name}: CGFloat = ${value}`).join('\n')}
    }
    enum Motion {
        static let fast: Double = ${tokens.motion.fast / 1000}
        static let base: Double = ${tokens.motion.base / 1000}
        static let slow: Double = ${tokens.motion.slow / 1000}
    }
    /// Semantic colors resolve through the asset catalog so light and dark follow the system.
    enum Palette {
${Object.keys(tokens.color.light).map(name => `        static let ${name} = Color("${name[0].toUpperCase()}${name.slice(1)}")`).join('\n')}
    }
}
`;
const component = hex => channel => (parseInt(hex.slice(1 + channel * 2, 3 + channel * 2), 16) / 255).toFixed(5);
const colorEntry = (hex, dark) => ({
  idiom: 'universal',
  color: { 'color-space': 'srgb', components: { red: component(hex)(0), green: component(hex)(1), blue: component(hex)(2), alpha: '1.000' } },
  ...(dark ? { appearances: [{ appearance: 'luminosity', value: 'dark' }] } : {}),
});
const colorset = (light, dark) => `${JSON.stringify({ colors: [colorEntry(light, false), colorEntry(dark, true)], info: { author: 'xcode', version: 1 } }, null, 2)}\n`;
const assets = 'ios/Moodie/Resources/Assets.xcassets';
const feelingName = key => `Feeling${key[0].toUpperCase()}${key.slice(1)}`;
// Names the app already uses keep working: SecondaryInk and AccentColor are aliases.
const legacy = { SecondaryInk: 'inkSecondary', AccentColor: 'accent' };

const outputs = [
  ['src/styles/tokens.css', css],
  ['ios/Moodie/Design/Tokens.swift', swift],
  ...Object.keys(tokens.color.light).map(name => [`${assets}/${name[0].toUpperCase()}${name.slice(1)}.colorset/Contents.json`, colorset(tokens.color.light[name], tokens.color.dark[name])]),
  ...Object.entries(legacy).map(([asset, name]) => [`${assets}/${asset}.colorset/Contents.json`, colorset(tokens.color.light[name], tokens.color.dark[name])]),
  ...Object.keys(tokens.feeling.light).map(key => [`${assets}/${feelingName(key)}.colorset/Contents.json`, colorset(tokens.feeling.light[key], tokens.feeling.dark[key])]),
];

let stale = false;
for (const [relative, content] of outputs) {
  const file = path.join(root, relative);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (current === content) continue;
  if (check) { console.error(`Stale generated file: ${relative}`); stale = true; continue; }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`wrote ${relative}`);
}
if (stale) { console.error('Run `npm run tokens`.'); process.exit(1); }
if (check) console.log('Design tokens are current.');
