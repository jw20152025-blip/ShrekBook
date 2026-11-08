/* SHREKBOOK THEME SYSTEM — RESTORED COLLECTION */
(function () {
"use strict";
const STORAGE_KEY="shrekbook-theme";
const THEMES=["default","dark","legacy","ivory","midnight","terminal","ocean","sunset","monochrome","shrekbook-special","random-colors","random-selection"];
const VISUAL=THEMES.filter(t=>t!=="random-colors"&&t!=="random-selection");
const LABELS={"default":"☀️ Default","dark":"🌑 Dark","legacy":"🕰️ Legacy","ivory":"📜 Ivory","midnight":"🌌 Midnight","terminal":"💻 Terminal","ocean":"🌊 Ocean","sunset":"🌇 Sunset","monochrome":"◼ Monochrome","shrekbook-special":"🟢 ShrekBook Special","random-colors":"🎲 Random Colors","random-selection":"🎰 Random Selection"};
function getSavedTheme(){const v=localStorage.getItem(STORAGE_KEY);return THEMES.includes(v)?v:"default";}
function clearRandom(){["--sb-bg","--sb-surface","--sb-text","--sb-muted","--sb-border","--sb-accent","--sb-accent-text","--sb-random-text"].forEach(v=>document.documentElement.style.removeProperty(v));}
function randomHex(){return "#"+Math.floor(Math.random()*16777215).toString(16).padStart(6,"0");}
function setRandomColors(){const r=document.documentElement,bg=randomHex(),surface=randomHex(),fg=randomHex(),accent=randomHex();r.style.setProperty("--sb-bg",bg);r.style.setProperty("--sb-surface",surface);r.style.setProperty("--sb-text",fg);r.style.setProperty("--sb-muted",fg);r.style.setProperty("--sb-border",accent);r.style.setProperty("--sb-accent",accent);r.style.setProperty("--sb-accent-text","#fff");r.style.setProperty("--sb-random-text",fg);}
function updateSelector(theme){const s=document.getElementById("theme-selector");if(s)s.value=theme;}
function applyTheme(theme,persist=true){
 if(theme==="random-selection"){const choices=VISUAL.filter(t=>t!==getSavedTheme());theme=choices[Math.floor(Math.random()*choices.length)]||"default";}
 if(!THEMES.includes(theme))theme="default";
 clearRandom();
 if(theme==="default")document.documentElement.removeAttribute("data-theme");
 else {document.documentElement.setAttribute("data-theme",theme);if(theme==="random-colors")setRandomColors();}
 if(persist)localStorage.setItem(STORAGE_KEY,theme);
 updateSelector(theme);
}
function createThemeSelector(){
 const nav=document.querySelector(".navbar nav");if(!nav||document.getElementById("theme-selector"))return;
 const select=document.createElement("select");select.id="theme-selector";select.className="theme-select";select.setAttribute("aria-label","Choose ShrekBook theme");
 [["Original themes",["default","dark","legacy"]],["Additional themes",["ivory","midnight","terminal","ocean","sunset","monochrome","shrekbook-special"]],["Experimental themes"],["Random themes",["random-colors","random-selection"]]].forEach(([label,items])=>{const group=document.createElement("optgroup");group.label=label;items.forEach(t=>{const o=document.createElement("option");o.value=t;o.textContent=LABELS[t];group.appendChild(o);});select.appendChild(group);});
 select.addEventListener("change",()=>applyTheme(select.value));nav.appendChild(select);updateSelector(getSavedTheme());
}
function init(){applyTheme(getSavedTheme(),false);createThemeSelector();}
window.ShrekBookThemes={set:applyTheme,get:getSavedTheme,list:THEMES.slice()};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();