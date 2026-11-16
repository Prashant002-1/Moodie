/** Every person has a colour, chosen from their username so it is the same everywhere and on every device. */
const HUES = 7;
export const personHue = (username: string) => {
  let sum = 0;
  for (const character of username.toLowerCase()) sum = (sum * 31 + character.charCodeAt(0)) % 9973;
  return (sum % HUES) + 1;
};
