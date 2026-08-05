import{a as r,c as f}from"./serverContract-ByLuWsyi.js";import{s as i}from"./index-CfJyXI2L.js";const l=800;function A(c){const n=new Set;for(const o of c??[]){const t=String((o==null?void 0:o.text)??"");if(t){t.length<=r&&i(t)&&n.add(t);for(const s of t.split(`
`)){const e=s.trimEnd();!e||!i(e)||n.add(f(e))}}}return[...n].slice(0,l)}export{A as collectRuleCheckKiwiPrefetchSurfaces};
