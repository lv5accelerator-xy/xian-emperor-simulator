"use strict";
// Small DOM model for focus behavior only; production code runs unchanged in a VM.
function focusDom() {
  const events=new Map(),timers=new Map();let timer=0;
  const document={activeElement:null};
  class Element {
    constructor(tag="div",id="") { this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.attributes=new Map();this.style={visibility:"visible",display:"block"};this.disabled=false;this.checked=false;this.parentElement=null;this.form=null;this.dataset={};this.type="";this.name="";this.className=""; }
    get isConnected(){return this===document.body||Boolean(this.parentElement?.isConnected);}
    get tabIndex(){if(this.hasAttribute("tabindex"))return Number(this.getAttribute("tabindex"));return /^(BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(this.tagName)||this.hasAttribute("href")?0:-1;}
    set tabIndex(value){this.setAttribute("tabindex",String(value));}
    get classList(){return{contains:key=>this.className.split(/\s+/).includes(key),add:key=>{this.className+=" "+key;},remove:key=>{this.className=this.className.split(/\s+/).filter(v=>v!==key).join(" ");}};}
    setAttribute(key,value){this.attributes.set(key,String(value));if(key.startsWith("data-"))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
    getAttribute(key){return this.attributes.get(key)??null;} hasAttribute(key){return this.attributes.has(key);} removeAttribute(key){this.attributes.delete(key);}
    appendChild(child){child.remove();child.parentElement=this;this.children.push(child);return child;}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
    contains(node){return node===this||this.children.some(child=>child.contains(node));}
    matches(selector){return selector.split(",").some(raw=>{const s=raw.trim();if(s===":disabled")return this.disabled||Boolean(this.parentElement?.closest("fieldset:disabled"));if(s==="fieldset:disabled")return this.tagName==="FIELDSET"&&this.disabled;
      const tag=s.match(/^[a-z]+/i)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;
      for(const m of s.matchAll(/#([\w-]+)/g))if(this.id!==m[1])return false;
      for(const m of s.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(m[1]))return false;
      for(const m of s.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g))if(!this.hasAttribute(m[1])||(m[2]!==undefined&&this.getAttribute(m[1])!==m[2]))return false;
      return Boolean(tag||/[#.\[]/.test(s));});}
    closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;}
    querySelectorAll(selector){const result=[];for(const child of this.children){if(child.matches(selector))result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    getClientRects(){for(let n=this;n;n=n.parentElement)if(n.hasAttribute("hidden")||n.classList.contains("hidden")||n.style.display==="none")return[];return this.isConnected?[{}]:[];}
    focus(){if(!this.isConnected||this.disabled||this.closest("[inert]")||!this.getClientRects().length||this.style.visibility==="hidden")return;
      const old=document.activeElement;document.activeElement=this;if(old!==this){for(const fn of [...(old?.blurHandlers||[])])fn();document.fire("focusin",{target:this});}}
    addEventListener(type,fn){if(type==="blur")(this.blurHandlers||=[]).push(fn);} removeEventListener(type,fn){if(type==="blur")this.blurHandlers=(this.blurHandlers||[]).filter(f=>f!==fn);}
  }
  document.body=new Element("body","body");document.activeElement=document.body;
  document.getElementById=id=>[document.body,...document.body.querySelectorAll("[id]")].find(n=>n.id===id)||findId(document.body,id);
  function findId(node,id){for(const child of node.children){if(child.id===id)return child;const found=findId(child,id);if(found)return found;}return null;}
  document.querySelectorAll=selector=>document.body.querySelectorAll(selector);document.querySelector=selector=>document.body.querySelector(selector);
  document.addEventListener=(type,fn)=>{if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);};document.removeEventListener=(type,fn)=>events.get(type)?.delete(fn);
  document.fire=(type,options={})=>{const event={type,prevented:false,defaultPrevented:false,key:"",shiftKey:false,target:document.activeElement,preventDefault(){this.prevented=this.defaultPrevented=true;},...options};for(const fn of [...(events.get(type)||[])])fn(event);return event;};
  const add=(parent,tag,id,attrs={})=>{const el=parent.appendChild(new Element(tag,id));for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;};
  const shell=add(document.body,"main","game-shell"),opener=add(shell,"button","opener"),backdrop=add(document.body,"div","modal-backdrop"),dialog=add(backdrop,"section","",{role:"dialog","aria-modal":"true",tabindex:"-1"});dialog.className="modal";
  const select=add(dialog,"select","field"),cancel=add(dialog,"button","cancel"),confirm=add(dialog,"button","confirm");
  const setTimeout=fn=>{timers.set(++timer,fn);return timer;},clearTimeout=id=>timers.delete(id),flush=()=>{let n=0;while(timers.size){if(++n>50)throw new Error("focus timers must settle");const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
  const getComputedStyle=el=>({visibility:el.style.visibility,display:el.style.display});
  opener.focus();
  return{document,Element,add,shell,opener,backdrop,dialog,select,cancel,confirm,setTimeout,clearTimeout,flush,getComputedStyle,events};
}
module.exports={focusDom};
