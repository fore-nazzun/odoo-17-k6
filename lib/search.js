// OR-over-fields domain, like the search bar builds from typed text.
//   ilikeOr('abc', ['name','ref']) -> ['|', ['name','ilike','abc'], ['ref','ilike','abc']]
//   ilikeOr('', [...])             -> []  (match everything)
export function ilikeOr(term, fields) {
  if (!term) return [];
  const leaves = fields.map((f) => [f, 'ilike', term]);
  const ops = new Array(leaves.length - 1).fill('|');
  return ops.concat(leaves);
}
