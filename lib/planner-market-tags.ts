/** A bare market code matches itself and CODE-…; a complete label stays exact. */
const normalize=(value:string)=>value.trim().toLocaleUpperCase('fr-FR').replace(/[‐‑‒–—−]/g,'-').replace(/\s*-\s*/g,'-');
export function plannerLabelMatches(label:string,rule:string):boolean{
 const value=normalize(label),tag=normalize(rule);
 return !!tag&&(value===tag||!tag.includes('-')&&value.startsWith(tag+'-'));
}
export function matchesPlannerMarket(labels:readonly string[],rules:readonly string[]):boolean{
 return rules.some(rule=>labels.some(label=>plannerLabelMatches(label,rule)));
}
