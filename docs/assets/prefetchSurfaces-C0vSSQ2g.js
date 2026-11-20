import{K as f,p as i,b as l}from"./index-kmFXZSP0.js";const r=800;function u(c){const n=new Set;for(const e of c??[]){const t=String((e==null?void 0:e.text)??"");if(t){t.length<=f&&i(t)&&n.add(t);for(const s of t.split(`
`)){const o=s.trimEnd();!o||!i(o)||n.add(l(o))}}}return[...n].slice(0,r)}export{u as collectRuleCheckKiwiPrefetchSurfaces};
