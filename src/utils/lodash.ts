export function _set(obj: Record<string, any>, path: string | string[], value: any) {
  if (Object(obj) !== obj) return obj;
  const keys = Array.isArray(path)
    ? path
    : path
        .replace(/\[(\d+)\]/g, '.$1') // convert indexes to properties
        .replace(/^\./, '') // strip leading dot
        .split('.');

  let current = obj;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      if (Object(current[key]) !== current[key]) {
        // If next key is a number, create array; else object
        current[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      }
      current = current[key];
    }
  }
  return obj;
}
