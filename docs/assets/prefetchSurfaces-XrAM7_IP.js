import{K as f,o as i,b as l}from"./index-BAtri8SO.js";const r=800;function u(c){const n=new Set;for(const o of c??[]){const t=String((o==null?void 0:o.text)??"");if(t){t.length<=f&&i(t)&&n.add(t);for(const s of t.split(`
`)){const e=s.trimEnd();!e||!i(e)||n.add(l(e))}}}return[...n].slice(0,r)}export{u as collectRuleCheckKiwiPrefetchSurfaces};
