/**
 * DataLoader — fetches and caches characters.json & glossary.json
 */

let _characters = null;
let _glossary = null;

export async function loadCharacters() {
  if (_characters) return _characters;
  const res = await fetch('/data/characters.json');
  const data = await res.json();
  _characters = data.characters;
  return _characters;
}

export async function loadGlossary() {
  if (_glossary) return _glossary;
  const res = await fetch('/data/glossary.json');
  const data = await res.json();
  _glossary = data.glossary;
  return _glossary;
}

export function getGlossary() {
  return _glossary || [];
}

export function getCharacters() {
  return _characters || [];
}

/**
 * Parses a base size string like "50mm" into inches.
 * 1 inch = 25.4mm
 */
export function baseSizeToInches(baseStr) {
  const mm = parseFloat(baseStr) || 50;
  return mm / 25.4;
}

/**
 * Get all titan characters from the loaded data.
 */
export function getTitans() {
  if (!_characters) return [];
  return _characters.filter(c => {
    const classes = c.class || [];
    return classes.some(cl => cl.toUpperCase() === 'TITAN');
  });
}

/**
 * Get non-titan characters.
 */
export function getHeroes() {
  if (!_characters) return [];
  return _characters.filter(c => {
    const classes = c.class || [];
    const isTitan = classes.some(cl => cl.toUpperCase() === 'TITAN');
    const isTransformOnly = c.isTransformOnly === true;
    return !isTitan && !isTransformOnly;
  });
}
