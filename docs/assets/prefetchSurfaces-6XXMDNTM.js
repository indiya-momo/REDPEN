import{a as s,c as f}from"./serverContract-ByLuWsyi.js";import{d as i}from"./index-D1PR-iWE.js";const l=800;function A(c){const n=new Set;for(const o of c??[]){const t=String((o==null?void 0:o.text)??"");if(t){t.length<=s&&i(t)&&n.add(t);for(const r of t.split(`
`)){const e=r.trimEnd();!e||!i(e)||n.add(f(e))}}}return[...n].slice(0,l)}export{A as collectRuleCheckKiwiPrefetchSurfaces};
