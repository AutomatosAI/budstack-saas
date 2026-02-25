var AutomatosWidget=(function(exports){'use strict';var z=class{constructor(){this.listeners=new Map;}on(t,e){this.listeners.has(t)||this.listeners.set(t,new Set);let s=this.listeners.get(t);return s.add(e),()=>s.delete(e)}once(t,e){let s=this.on(t,a=>{s(),e(a);});return s}emit(t,e){let s=this.listeners.get(t);if(s)for(let a of s)try{a(e);}catch(i){console.error(`[automatos] Event listener error (${String(t)}):`,i);}}off(t,e){e?this.listeners.get(t)?.delete(e):this.listeners.delete(t);}removeAll(){this.listeners.clear();}},y=class extends Error{constructor(t,e){super(t),this.code=e,this.name="AutomatosError";}},k=class extends y{constructor(t){super(t,"AUTH_ERROR"),this.name="AuthError";}},g=class extends y{constructor(t,e,s){super(t,"NETWORK_ERROR"),this.name="NetworkError",this.status=e,this.retryAfter=s;}get isRateLimited(){return this.status===429}},B=class extends y{constructor(t){super(t,"STREAM_ERROR"),this.name="StreamError";}},m="__aw_session",L=class{constructor(t,e){this.session=null,this.refreshTimer=null,this.baseUrl=t,this.apiKey=e,this.loadCachedSession();}get isPublicKey(){return this.apiKey.startsWith("ak_pub_")}async getAuthHeader(){return this.isPublicKey?`Bearer ${this.apiKey}`:`Bearer ${(await this.ensureSession()).token}`}get workspaceId(){return this.session?.workspaceId}async authenticate(){let t=await fetch(`${this.baseUrl}/api/widgets/auth`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:this.apiKey})});if(!t.ok){let s=await t.text();throw t.status===401||t.status===403?new k(s||"Authentication failed"):new g(s||"Authentication request failed",t.status)}let e=await t.json();return this.cacheSession(e),this.scheduleRefresh(e),e}destroy(){this.refreshTimer&&(clearTimeout(this.refreshTimer),this.refreshTimer=null),this.session=null;try{sessionStorage.removeItem(m);}catch{}}async ensureSession(){return this.session&&this.session.expiresAt>Date.now()+6e4?this.session:(await this.authenticate(),this.session)}cacheSession(t){this.session={token:t.session_token,expiresAt:new Date(t.expires_at).getTime(),workspaceId:t.workspace_id,permissions:t.permissions};try{sessionStorage.setItem(m,JSON.stringify(this.session));}catch{}}loadCachedSession(){try{let t=sessionStorage.getItem(m);if(t){let e=JSON.parse(t);e.expiresAt>Date.now()+6e4?this.session=e:sessionStorage.removeItem(m);}}catch{}}scheduleRefresh(t){this.refreshTimer&&clearTimeout(this.refreshTimer);let e=new Date(t.expires_at).getTime(),s=Math.max(e-Date.now()-5*6e4,3e4);this.refreshTimer=setTimeout(()=>{this.authenticate().catch(()=>{});},s);}},I=0;function x(){return `msg_${Date.now()}_${++I}`}var _=class{constructor(){this.messages=[],this.conversationId=null;}getMessages(){return this.messages}addUserMessage(t){let e={id:x(),role:"user",content:t,timestamp:Date.now(),status:"sending"};return this.messages.push(e),e}addAssistantPlaceholder(){let t={id:x(),role:"assistant",content:"",timestamp:Date.now(),status:"streaming"};return this.messages.push(t),t}addGreeting(t){let e={id:x(),role:"assistant",content:t,timestamp:Date.now(),status:"complete"};return this.messages.push(e),e}appendChunk(t,e){let s=this.messages.find(a=>a.id===t);return s?(s.content+=e,s.content):""}finalizeMessage(t){let e=this.messages.find(s=>s.id===t);e&&(e.status="complete");}markSent(t){let e=this.messages.find(s=>s.id===t);e&&(e.status="complete");}markError(t,e){let s=this.messages.find(a=>a.id===t);s&&(s.status="error",e&&(s.content=e));}loadHistory(t){this.messages=t.map(e=>({id:e.id,role:e.role,content:e.content,timestamp:new Date(e.created_at).getTime(),status:"complete"}));}clear(){this.messages=[],this.conversationId=null;}};async function*R(t,e){let s=t.getReader(),a=new TextDecoder,i="",o="message";try{for(;!e?.aborted;){let{done:n,value:l}=await s.read();if(n)break;i+=a.decode(l,{stream:!0});let d=i.split(`

`);i=d.pop()??"";for(let h of d){if(!h.trim())continue;let p=null;for(let r of h.split(`
`))if(r.startsWith("event:"))o=r.slice(6).trim();else if(r.startsWith("data:")){let u=r.slice(5).trim();if(!u)continue;try{p=JSON.parse(u);}catch{p={content:u};}}p&&(yield {event:o,data:p},o="message");}}if(i.trim()){for(let n of i.split(`
`))if(n.startsWith("data:")){let l=n.slice(5).trim();if(l)try{let d=JSON.parse(l);yield {event:o,data:d};}catch{yield {event:o,data:{content:l}};}}}}catch(n){if(e?.aborted)return;throw new B(n instanceof Error?n.message:"Stream reading failed")}finally{s.releaseLock();}}var D="https://api.automatos.app",E=class{constructor(t){this.events=new z,this.conversation=new _,this.abortController=null,this.config=t,this.baseUrl=(t.baseUrl??D).replace(/\/$/,""),this.auth=new L(this.baseUrl,t.apiKey);}async authenticate(){if(!this.auth.isPublicKey)try{let t=await this.auth.authenticate();this.events.emit("auth:success",{workspaceId:t.workspace_id});}catch(t){let e=t instanceof Error?t:new Error(String(t));throw this.events.emit("auth:error",e),t}}async sendMessage(t){let e=this.conversation.addUserMessage(t);this.events.emit("chat:message",e),this.conversation.markSent(e.id);let s=this.conversation.addAssistantPlaceholder();this.events.emit("chat:message",s),this.abortController=new AbortController;try{let a={message:t,conversation_id:this.conversation.conversationId??void 0,agent_id:this.config.agentId,model_id:this.config.modelId},i=await this.auth.getAuthHeader(),o=await fetch(`${this.baseUrl}/api/widgets/chat`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:i},body:JSON.stringify(a),signal:this.abortController.signal});if(!o.ok)return await this.handleErrorResponse(o,s.id),{userMessage:e,assistantMessage:s};if(!o.body)throw new g("No response body",o.status);for await(let n of R(o.body,this.abortController.signal))this.handleSSEEvent(n,s.id);this.conversation.getMessages().find(n=>n.id===s.id)?.status==="streaming"&&(this.conversation.finalizeMessage(s.id),this.events.emit("chat:done",{messageId:s.id,conversationId:this.conversation.conversationId??""}));}catch(a){if(this.abortController?.signal.aborted)return {userMessage:e,assistantMessage:s};let i=a instanceof Error?a:new Error(String(a));this.conversation.markError(s.id),this.events.emit("chat:error",{messageId:s.id,error:i});}finally{this.abortController=null;}return {userMessage:e,assistantMessage:s}}async getHistory(t){let e=await this.auth.getAuthHeader(),s=await fetch(`${this.baseUrl}/api/widgets/chat/${t}`,{headers:{Authorization:e}});if(!s.ok)throw new g("Failed to fetch history",s.status);let a=await s.json();return this.conversation.conversationId=t,this.conversation.loadHistory(a),a}abort(){this.abortController?.abort();}destroy(){this.abort(),this.auth.destroy(),this.conversation.clear(),this.events.removeAll();}handleSSEEvent(t,e){switch(t.event){case "message":{let s=t.data.content??"",a=this.conversation.appendChunk(e,s);this.events.emit("chat:chunk",{messageId:e,content:s,fullContent:a});break}case "tool-start":this.events.emit("chat:tool-start",{tool:t.data.tool,arguments:t.data.arguments});break;case "tool-end":this.events.emit("chat:tool-end",{tool:t.data.tool,result:t.data.result});break;case "done":{let s=t.data.conversation_id;this.conversation.conversationId=s,this.conversation.finalizeMessage(e),this.events.emit("chat:done",{messageId:e,conversationId:s});break}case "error":{let s=t.data.message??"Unknown error";this.conversation.markError(e,s),this.events.emit("chat:error",{messageId:e,error:new Error(s)});break}}}async handleErrorResponse(t,e){let s=await t.text().catch(()=>"");if(t.status===401||t.status===403){try{await this.authenticate();}catch{}let i=new k(s||"Authentication failed");this.conversation.markError(e,"Authentication failed. Please refresh the page."),this.events.emit("chat:error",{messageId:e,error:i});return}if(t.status===429){let i=parseInt(t.headers.get("Retry-After")??"60",10),o=new g("Rate limited",429,i);this.conversation.markError(e,`Too many requests. Please wait ${i} seconds.`),this.events.emit("chat:error",{messageId:e,error:o});return}let a=new g(s||`Request failed (${t.status})`,t.status);this.conversation.markError(e,"Something went wrong. Please try again."),this.events.emit("chat:error",{messageId:e,error:a});}};function H(t,e){let s=document.createElement("div");s.id="automatos-widget",s.setAttribute("data-theme",t.theme??"light"),s.setAttribute("data-position",t.position??"bottom-right");let a=s.attachShadow({mode:"open"}),i=document.createElement("style");i.textContent=e,a.appendChild(i);let o=document.createElement("div");if(o.className="aw-root",a.appendChild(o),t.themeOverrides)for(let[n,l]of Object.entries(t.themeOverrides))s.style.setProperty(n,l,"important");return document.body.appendChild(s),{host:s,shadow:a,container:o}}function c(t,e,s){let a=document.createElement(t);if(e)for(let[i,o]of Object.entries(e))i.startsWith("on")&&typeof o=="function"?a.addEventListener(i.slice(2).toLowerCase(),o):i==="class"&&typeof o=="string"?a.className=o:i==="style"&&typeof o=="object"&&o?Object.assign(a.style,o):i==="dataset"&&typeof o=="object"&&o?Object.assign(a.dataset,o):typeof o=="string"?a.setAttribute(i,o):typeof o=="boolean"&&o&&a.setAttribute(i,"");if(s)for(let i of s)typeof i=="string"?a.appendChild(document.createTextNode(i)):i&&a.appendChild(i);return a}var W=new DOMParser;function w(t){return W.parseFromString(t,"image/svg+xml").documentElement}var b={chat:()=>w('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'),close:()=>w('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'),send:()=>w('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'),copy:()=>w('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'),check:()=>w('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>')},j=class{constructor(t){this.isOpen=false,this.badge=c("span",{class:"aw-fab-badge"}),this.el=c("button",{class:"aw-fab","aria-label":"Open chat","data-open":"false",onClick:()=>t.onClick()},[b.chat(),b.close(),this.badge]);}setOpen(t){this.isOpen=t,this.el.setAttribute("data-open",String(t)),this.el.setAttribute("aria-label",t?"Close chat":"Open chat"),t&&this.hideBadge();}showBadge(){this.isOpen||this.badge.classList.add("visible");}hideBadge(){this.badge.classList.remove("visible");}};function N(t){let e=t.title||"Automatos AI",s=e.charAt(0).toUpperCase();return c("div",{class:"aw-header"},[c("div",{class:"aw-header-logo"},[s]),c("span",{class:"aw-header-title"},[e]),c("button",{class:"aw-header-close","aria-label":"Close chat",onClick:()=>t.onClose()},[b.close()])])}var P=class{constructor(t){this.headerEl=N({onClose:t.onClose,title:t.title}),this.messagesContainer=c("div",{class:"aw-messages",role:"log","aria-live":"polite","aria-label":"Chat messages"}),this.inputArea=c("div",{class:"aw-input-area"});let e=c("div",{class:"aw-powered"},["Powered by ",c("a",{href:"https://automatos.app",target:"_blank",rel:"noopener noreferrer"},["Automatos AI"])]);this.el=c("div",{class:"aw-panel","data-state":"closed",role:"dialog","aria-label":"Chat widget"},[this.headerEl,this.messagesContainer,this.inputArea,e]);}show(){this.el.setAttribute("data-state","open");}hide(){this.el.setAttribute("data-state","closed");}get isOpen(){return this.el.getAttribute("data-state")==="open"}};function $(t){let e=t.split(`
`),s=[],a=0;for(;a<e.length;){let i=e[a];if(i.trimStart().startsWith("```")){let l=[];for(a++;a<e.length&&!e[a].trimStart().startsWith("```");)l.push(e[a]),a++;a++,s.push(K(l.join(`
`)));continue}let o=i.match(/^(#{1,3})\s+(.+)/);if(o){let l=o[1].length,d=o[2],h=document.createElement(`h${l}`);v(h,d),s.push(h),a++;continue}if(/^-{3,}$/.test(i.trim())||/^\*{3,}$/.test(i.trim())){s.push(document.createElement("hr")),a++;continue}if(/^\s*[-*+]\s+/.test(i)){let l=[];for(;a<e.length&&/^\s*[-*+]\s+/.test(e[a]);)l.push(e[a].replace(/^\s*[-*+]\s+/,"")),a++;s.push(A("ul",l));continue}if(/^\s*\d+\.\s+/.test(i)){let l=[];for(;a<e.length&&/^\s*\d+\.\s+/.test(e[a]);)l.push(e[a].replace(/^\s*\d+\.\s+/,"")),a++;s.push(A("ol",l));continue}if(!i.trim()){a++;continue}let n=[];for(;a<e.length&&e[a].trim()&&!e[a].trimStart().startsWith("```")&&!e[a].match(/^#{1,3}\s+/)&&!/^\s*[-*+]\s+/.test(e[a])&&!/^\s*\d+\.\s+/.test(e[a])&&!/^-{3,}$/.test(e[a].trim());)n.push(e[a]),a++;if(n.length>0){let l=document.createElement("p");v(l,n.join(`
`)),s.push(l);}}return s}function v(t,e){let s=U(e);for(let a of s)t.appendChild(a);}function U(t){let e=[],s=t;for(;s.length>0;){let a=s.length,i="",o=0,n="",l="",d=s.indexOf("**");if(d>=0&&d<a){let r=s.indexOf("**",d+2);r>=0&&(a=d,i="bold",o=r+2-d,n=s.slice(d+2,r));}let h=s.indexOf("`");if(h>=0&&h<a){let r=s.indexOf("`",h+1);r>=0&&(a=h,i="code",o=r+1-h,n=s.slice(h+1,r));}let p=s.indexOf("[");if(p>=0&&p<a){let r=s.indexOf("](",p);if(r>=0){let u=s.indexOf(")",r+2);u>=0&&(a=p,i="link",o=u+1-p,n=s.slice(p+1,r),l=s.slice(r+2,u));}}if(i!=="bold"){let r=s.indexOf("*");if(r>=0&&r<a&&s[r+1]!=="*"){let u=s.indexOf("*",r+1);u>=0&&s[u-1]!=="*"&&(a=r,i="italic",o=u+1-r,n=s.slice(r+1,u));}}if(a>0&&C(e,s.slice(0,a)),!i){s.length>0&&a===s.length&&C(e,s);break}switch(i){case "bold":{let r=document.createElement("strong");r.textContent=n,e.push(r);break}case "italic":{let r=document.createElement("em");r.textContent=n,e.push(r);break}case "code":{let r=document.createElement("code");r.textContent=n,e.push(r);break}case "link":{let r=document.createElement("a");r.textContent=n,r.href=F(l),r.target="_blank",r.rel="noopener noreferrer",e.push(r);break}}s=s.slice(a+o);}return e}function C(t,e){let s=e.split(`
`);for(let a=0;a<s.length;a++)s[a]&&t.push(document.createTextNode(s[a])),a<s.length-1&&t.push(document.createElement("br"));}function K(t){let e=document.createElement("pre"),s=document.createElement("code");return s.textContent=t,e.appendChild(s),e}function A(t,e){let s=document.createElement(t);for(let a of e){let i=document.createElement("li");v(i,a),s.appendChild(i);}return s}function F(t){let e=t.trim();return e.startsWith("http://")||e.startsWith("https://")||e.startsWith("mailto:")||e.startsWith("/")?e:"#"}function S(t){let e=t.status==="error"?"aw-bubble-error":t.role==="user"?"aw-bubble-user":"aw-bubble-assistant",s=c("div",{class:"aw-bubble-content"});t.role==="user"?s.appendChild(document.createTextNode(t.content)):M(s,t.content);let a=new Date(t.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),i=c("div",{class:"aw-bubble-time"},[a]);return c("div",{class:`aw-bubble ${e}`,"data-message-id":t.id},[s,i])}function T(t,e){let s=t.querySelector(".aw-bubble-content");if(s){for(;s.firstChild;)s.removeChild(s.firstChild);M(s,e);}}function q(t){t.classList.remove("aw-bubble-error");let e=t.querySelectorAll("pre");for(let s of e){if(s.querySelector(".aw-code-copy"))continue;let a=c("button",{class:"aw-code-copy","aria-label":"Copy code",onClick:()=>{let i=s.querySelector("code")?.textContent??"";navigator.clipboard.writeText(i).then(()=>{a.replaceChildren(b.check()),setTimeout(()=>a.replaceChildren(b.copy()),2e3);});}},[b.copy()]);s.style.position="relative",s.appendChild(a);}}function M(t,e){if(!e)return;let s=$(e);for(let a of s)t.appendChild(a);}var G=class{constructor(t){this.bubbleMap=new Map,this.shouldAutoScroll=true,this.container=t,this.container.addEventListener("scroll",()=>{let{scrollTop:e,scrollHeight:s,clientHeight:a}=this.container;this.shouldAutoScroll=s-e-a<80;});}addMessage(t){let e=S(t);return this.bubbleMap.set(t.id,e),this.container.appendChild(e),this.scrollToBottom(),e}updateStreamingMessage(t,e){let s=this.bubbleMap.get(t);if(s)T(s,e);else {let a={id:t,role:"assistant",content:e,timestamp:Date.now(),status:"streaming"};s=S(a),this.bubbleMap.set(t,s),this.container.appendChild(s);}this.scrollToBottom();}finalizeMessage(t){let e=this.bubbleMap.get(t);e&&q(e);}markError(t,e){let s=this.bubbleMap.get(t);s&&(s.classList.remove("aw-bubble-assistant"),s.classList.add("aw-bubble-error"),e&&T(s,e));}showTyping(){let t=document.createElement("div");t.className="aw-typing",t.setAttribute("aria-label","Assistant is typing");for(let e=0;e<3;e++){let s=document.createElement("span");s.className="aw-typing-dot",t.appendChild(s);}return this.container.appendChild(t),this.scrollToBottom(),t}removeTyping(t){t.remove();}scrollToBottom(){this.shouldAutoScroll&&requestAnimationFrame(()=>{this.container.scrollTop=this.container.scrollHeight;});}},J=class{constructor(t){this.disabled=false,this.textarea=document.createElement("textarea"),this.textarea.className="aw-textarea",this.textarea.placeholder="Type a message...",this.textarea.rows=1,this.textarea.setAttribute("aria-label","Message input"),this.sendBtn=c("button",{class:"aw-send-btn","aria-label":"Send message",disabled:true},[b.send()]),this.textarea.addEventListener("input",()=>{this.autoResize(),this.sendBtn.disabled=this.disabled||!this.textarea.value.trim();}),this.textarea.addEventListener("keydown",e=>{e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),this.submit(t.onSend));}),this.sendBtn.addEventListener("click",()=>{this.submit(t.onSend);}),this.el=c("div",{class:"aw-input-area"},[this.textarea,this.sendBtn]);}setDisabled(t){this.disabled=t,this.textarea.disabled=t,this.sendBtn.disabled=t||!this.textarea.value.trim();}focus(){this.textarea.focus();}clear(){this.textarea.value="",this.autoResize(),this.sendBtn.disabled=true;}submit(t){let e=this.textarea.value.trim();!e||this.disabled||(t(e),this.clear());}autoResize(){this.textarea.style.height="auto";let t=120;this.textarea.style.height=Math.min(this.textarea.scrollHeight,t)+"px";}},Y=`
/* \u2500\u2500 Reset \u2500\u2500 */
:host {
  all: initial;
  font-family: var(--aw-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 14px;
  line-height: 1.5;
  color: var(--aw-text, #1a1a1a);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:host *,
:host *::before,
:host *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.aw-root {
  position: fixed;
  z-index: 2147483647;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
}

/* \u2500\u2500 Theme: Light \u2500\u2500 */
:host([data-theme="light"]) {
  --aw-primary: #0066ff;
  --aw-primary-hover: #0052cc;
  --aw-bg: #ffffff;
  --aw-bg-secondary: #f5f5f5;
  --aw-text: #1a1a1a;
  --aw-text-secondary: #666666;
  --aw-border: #e5e5e5;
  --aw-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  --aw-radius: 16px;
  --aw-user-bg: var(--aw-primary);
  --aw-user-text: #ffffff;
  --aw-assistant-bg: var(--aw-bg-secondary);
  --aw-assistant-text: var(--aw-text);
  --aw-code-bg: #f0f0f0;
  --aw-code-text: #333333;
}

/* \u2500\u2500 Theme: Dark \u2500\u2500 */
:host([data-theme="dark"]) {
  --aw-primary: #4d94ff;
  --aw-primary-hover: #3d84ff;
  --aw-bg: #1a1a2e;
  --aw-bg-secondary: #252540;
  --aw-text: #e5e5e5;
  --aw-text-secondary: #999999;
  --aw-border: #333355;
  --aw-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --aw-radius: 16px;
  --aw-user-bg: var(--aw-primary);
  --aw-user-text: #ffffff;
  --aw-assistant-bg: var(--aw-bg-secondary);
  --aw-assistant-text: var(--aw-text);
  --aw-code-bg: #1e1e3a;
  --aw-code-text: #d4d4d4;
}

/* \u2500\u2500 Position \u2500\u2500 */
:host([data-position="bottom-right"]) .aw-root {
  right: 20px;
  bottom: 20px;
}

:host([data-position="bottom-left"]) .aw-root {
  left: 20px;
  bottom: 20px;
}
`,V=`
/* \u2500\u2500 FAB \u2500\u2500 */
.aw-fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--aw-primary);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  outline: none;
}

.aw-fab:hover {
  background: var(--aw-primary-hover);
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.aw-fab:focus-visible {
  outline: 2px solid var(--aw-primary);
  outline-offset: 3px;
}

.aw-fab svg {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.aw-fab[data-open="true"] svg:first-child {
  transform: rotate(90deg) scale(0);
  opacity: 0;
  position: absolute;
}

.aw-fab[data-open="true"] svg:last-child {
  transform: rotate(0deg) scale(1);
  opacity: 1;
}

.aw-fab[data-open="false"] svg:first-child {
  transform: rotate(0deg) scale(1);
  opacity: 1;
}

.aw-fab[data-open="false"] svg:last-child {
  transform: rotate(-90deg) scale(0);
  opacity: 0;
  position: absolute;
}

.aw-fab-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff3b30;
  border: 2px solid var(--aw-bg);
  display: none;
}

.aw-fab-badge.visible {
  display: block;
  animation: aw-pulse 1.5s ease infinite;
}

/* \u2500\u2500 Panel \u2500\u2500 */
.aw-panel {
  position: absolute;
  bottom: 72px;
  width: 380px;
  max-height: 600px;
  background: var(--aw-bg);
  border-radius: var(--aw-radius);
  box-shadow: var(--aw-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform-origin: bottom right;
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1),
              opacity 0.2s ease;
}

:host([data-position="bottom-right"]) .aw-panel {
  right: 0;
  transform-origin: bottom right;
}

:host([data-position="bottom-left"]) .aw-panel {
  left: 0;
  transform-origin: bottom left;
}

.aw-panel[data-state="closed"] {
  transform: scale(0.9);
  opacity: 0;
  pointer-events: none;
}

.aw-panel[data-state="open"] {
  transform: scale(1);
  opacity: 1;
}

/* \u2500\u2500 Header \u2500\u2500 */
.aw-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--aw-border);
  background: var(--aw-bg);
  min-height: 56px;
}

.aw-header-logo {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--aw-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 14px;
  margin-right: 10px;
  flex-shrink: 0;
}

.aw-header-title {
  font-size: 15px;
  font-weight: 600;
  flex: 1;
  color: var(--aw-text);
}

.aw-header-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--aw-text-secondary);
  transition: background 0.15s ease;
}

.aw-header-close:hover {
  background: var(--aw-bg-secondary);
}

.aw-header-close:focus-visible {
  outline: 2px solid var(--aw-primary);
  outline-offset: -2px;
}

.aw-header-close svg {
  width: 18px;
  height: 18px;
}

/* \u2500\u2500 Messages \u2500\u2500 */
.aw-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
  max-height: 420px;
  scroll-behavior: smooth;
}

.aw-messages::-webkit-scrollbar {
  width: 6px;
}

.aw-messages::-webkit-scrollbar-thumb {
  background: var(--aw-border);
  border-radius: 3px;
}

.aw-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  position: relative;
  animation: aw-fade-in 0.2s ease;
}

.aw-bubble-user {
  align-self: flex-end;
  background: var(--aw-user-bg);
  color: var(--aw-user-text);
  border-bottom-right-radius: 4px;
}

.aw-bubble-assistant {
  align-self: flex-start;
  background: var(--aw-assistant-bg);
  color: var(--aw-assistant-text);
  border-bottom-left-radius: 4px;
}

.aw-bubble-error {
  align-self: flex-start;
  background: #fff0f0;
  color: #cc0000;
  border: 1px solid #ffcccc;
  border-bottom-left-radius: 4px;
}

:host([data-theme="dark"]) .aw-bubble-error {
  background: #2a1a1a;
  color: #ff6b6b;
  border-color: #3a2020;
}

.aw-bubble-content {
  font-size: 14px;
  line-height: 1.5;
}

.aw-bubble-content p {
  margin-bottom: 8px;
}

.aw-bubble-content p:last-child {
  margin-bottom: 0;
}

.aw-bubble-content strong {
  font-weight: 600;
}

.aw-bubble-content em {
  font-style: italic;
}

.aw-bubble-content a {
  color: var(--aw-primary);
  text-decoration: underline;
}

.aw-bubble-content code {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  background: var(--aw-code-bg);
  color: var(--aw-code-text);
  padding: 2px 5px;
  border-radius: 4px;
}

.aw-bubble-content pre {
  background: var(--aw-code-bg);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  margin: 8px 0;
  position: relative;
}

.aw-bubble-content pre code {
  background: none;
  padding: 0;
  font-size: 12px;
  line-height: 1.6;
}

.aw-code-copy {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--aw-border);
  background: var(--aw-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--aw-text-secondary);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.aw-bubble-content pre:hover .aw-code-copy {
  opacity: 1;
}

.aw-bubble-content ul,
.aw-bubble-content ol {
  padding-left: 20px;
  margin: 8px 0;
}

.aw-bubble-content li {
  margin-bottom: 4px;
}

.aw-bubble-content h1,
.aw-bubble-content h2,
.aw-bubble-content h3 {
  font-weight: 600;
  margin: 12px 0 6px;
}

.aw-bubble-content h1 { font-size: 18px; }
.aw-bubble-content h2 { font-size: 16px; }
.aw-bubble-content h3 { font-size: 15px; }

.aw-bubble-time {
  font-size: 11px;
  color: var(--aw-text-secondary);
  margin-top: 4px;
  opacity: 0.7;
}

.aw-bubble-user .aw-bubble-time {
  color: rgba(255, 255, 255, 0.7);
}

/* \u2500\u2500 Typing Indicator \u2500\u2500 */
.aw-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 14px;
  background: var(--aw-assistant-bg);
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  align-self: flex-start;
  animation: aw-fade-in 0.2s ease;
}

.aw-typing-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--aw-text-secondary);
  opacity: 0.5;
  animation: aw-typing-bounce 1.2s ease-in-out infinite;
}

.aw-typing-dot:nth-child(2) { animation-delay: 0.15s; }
.aw-typing-dot:nth-child(3) { animation-delay: 0.3s; }

/* \u2500\u2500 Input \u2500\u2500 */
.aw-input-area {
  display: flex;
  align-items: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--aw-border);
  background: var(--aw-bg);
  gap: 8px;
}

.aw-textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--aw-border);
  border-radius: 12px;
  padding: 10px 14px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  color: var(--aw-text);
  background: var(--aw-bg);
  outline: none;
  min-height: 40px;
  max-height: 120px;
  overflow-y: auto;
  transition: border-color 0.15s ease;
}

.aw-textarea:focus {
  border-color: var(--aw-primary);
}

.aw-textarea::placeholder {
  color: var(--aw-text-secondary);
}

.aw-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.aw-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: var(--aw-primary);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.aw-send-btn:hover:not(:disabled) {
  background: var(--aw-primary-hover);
}

.aw-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.aw-send-btn:focus-visible {
  outline: 2px solid var(--aw-primary);
  outline-offset: 2px;
}

/* \u2500\u2500 Error Banner \u2500\u2500 */
.aw-error-banner {
  padding: 10px 16px;
  background: #fff0f0;
  color: #cc0000;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ffcccc;
}

:host([data-theme="dark"]) .aw-error-banner {
  background: #2a1a1a;
  color: #ff6b6b;
  border-color: #3a2020;
}

.aw-error-banner button {
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

/* \u2500\u2500 Powered By \u2500\u2500 */
.aw-powered {
  padding: 8px 16px;
  text-align: center;
  font-size: 11px;
  color: var(--aw-text-secondary);
  opacity: 0.6;
}

.aw-powered a {
  color: inherit;
  text-decoration: none;
}

.aw-powered a:hover {
  text-decoration: underline;
}
`,Q=`
@keyframes aw-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes aw-typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30% { transform: translateY(-4px); opacity: 1; }
}

@keyframes aw-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(255, 59, 48, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
}

/* Mobile responsive */
@media (max-width: 480px) {
  .aw-panel {
    width: calc(100vw - 16px) !important;
    max-height: calc(100vh - 100px) !important;
    bottom: 64px !important;
    right: 8px !important;
    left: 8px !important;
    border-radius: 12px !important;
  }

  .aw-fab {
    width: 48px !important;
    height: 48px !important;
  }

  .aw-fab svg {
    width: 20px;
    height: 20px;
  }
}
`,O=class{constructor(t){this.typingEl=null,this.hasGreeted=false,this.isStreaming=false,this.unsubs=[],this.keydownHandler=null,this.config=t,this.client=new E(t),this.mount(),this.wireEvents(),t.apiKey.startsWith("ak_pub_")||this.client.authenticate().catch(()=>{});}open(){this.panel.show(),this.fab.setOpen(true),this.client.events.emit("widget:open",void 0),!this.hasGreeted&&this.config.greeting&&this.showGreeting(),this.inputArea.focus(),this.trapFocus();}close(){this.panel.hide(),this.fab.setOpen(false),this.client.events.emit("widget:close",void 0),this.releaseFocus();}toggle(){this.panel.isOpen?this.close():this.open();}destroy(){this.client.destroy();for(let t of this.unsubs)t();this.unsubs=[],this.host.remove();}mount(){let t=[Y,V,Q].join(`
`),{host:e,shadow:s,container:a}=H(this.config,t);this.host=e,this.shadow=s,this.fab=new j({onClick:()=>this.toggle()}),this.panel=new P({onClose:()=>this.close(),title:this.config.title}),this.messageList=new G(this.panel.messagesContainer),this.inputArea=new J({onSend:i=>this.handleSend(i)}),this.panel.inputArea.replaceWith(this.inputArea.el),a.appendChild(this.panel.el),a.appendChild(this.fab.el),this.client.events.emit("widget:ready",void 0);}wireEvents(){let{events:t}=this.client;this.unsubs.push(t.on("chat:chunk",({messageId:e,fullContent:s})=>{this.messageList.updateStreamingMessage(e,s);})),this.unsubs.push(t.on("chat:done",({messageId:e})=>{this.isStreaming=false,this.removeTyping(),this.messageList.finalizeMessage(e),this.inputArea.setDisabled(false),this.inputArea.focus();})),this.unsubs.push(t.on("chat:error",({messageId:e,error:s})=>{this.isStreaming=false,this.removeTyping(),this.messageList.markError(e,s.message),this.inputArea.setDisabled(false),this.inputArea.focus();}));}async handleSend(t){if(this.isStreaming)return;this.isStreaming=true,this.inputArea.setDisabled(true);let e={id:`usr_${Date.now()}`,role:"user",content:t,timestamp:Date.now(),status:"complete"};this.messageList.addMessage(e),this.showTyping(),await this.client.sendMessage(t);}showGreeting(){if(this.hasGreeted)return;this.hasGreeted=true;let t=this.client.conversation.addGreeting(this.config.greeting);this.messageList.addMessage(t);}showTyping(){this.typingEl=this.messageList.showTyping();}removeTyping(){this.typingEl&&(this.messageList.removeTyping(this.typingEl),this.typingEl=null);}trapFocus(){this.keydownHandler=t=>{if(t.key==="Escape"){this.close();return}if(t.key==="Tab"){let e=this.shadow.querySelectorAll('button:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]');if(e.length===0)return;let s=e[0],a=e[e.length-1];t.shiftKey&&this.shadow.activeElement===s?(t.preventDefault(),a.focus()):!t.shiftKey&&this.shadow.activeElement===a&&(t.preventDefault(),s.focus());}},this.shadow.addEventListener("keydown",this.keydownHandler);}releaseFocus(){this.keydownHandler&&(this.shadow.removeEventListener("keydown",this.keydownHandler),this.keydownHandler=null);}};var f=null;function X(t){if(f){console.warn("[automatos] Widget already initialized. Call destroy() first.");return}f=new O(t);}function Z(){f?.destroy(),f=null;}function tt(){f?.open();}function et(){f?.close();}function st(){f?.toggle();}if(typeof window<"u"){let t=window,e=t.AutomatosWidget?.q;if(t.AutomatosWidget={init:X,destroy:Z,open:tt,close:et,toggle:st},Array.isArray(e))for(let[s,...a]of e){let i=t.AutomatosWidget[s];typeof i=="function"&&i(...a);}}exports.close=et;exports.destroy=Z;exports.init=X;exports.open=tt;exports.toggle=st;return exports;})({});//# sourceMappingURL=widget.global.js.map
//# sourceMappingURL=widget.global.js.map