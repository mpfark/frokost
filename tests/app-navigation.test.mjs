import { build } from 'esbuild';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({stdin:{contents:
  "export { AppHeader } from './src/components/layout/AppHeader'; export { AppSession } from './src/components/layout/AppSession'; export { default as Index } from './src/pages/Index'; export { MemoryRouter } from 'react-router-dom'; export { renderToStaticMarkup } from 'react-dom/server'; export { createElement } from 'react';", resolveDir:root},
  absWorkingDir:root,bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',logLevel:'silent',define:{'process.env.NODE_ENV':'\"production\"'},
  plugins:[{name:'mock-content-only',setup(build){
    build.onResolve({filter:/@\/components\/(lunch\/LunchCalendar|kitchen\/KitchenView|admin\/AdminPanel|profile\/ProfileSettings|catering\/OutlookCalendar|auth\/AuthForm)$/},args=>({path:args.path,namespace:'content'}));
    build.onLoad({filter:/.*/,namespace:'content'},args=>({contents:'export const '+args.path.split('/').at(-1)+' = () => "'+args.path.split('/').at(-1)+'";'}));
  }}]});
const module={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {AppHeader,AppSession,Index,MemoryRouter,renderToStaticMarkup,createElement:h}=module.exports;
const base={activeTab:'calendar',fullName:'Testbruger',role:'Medarbejder',signedIn:true,loading:false,isAdmin:false,canAccessKitchen:false,onLogout(){},loggingOut:false};
const header=props=>renderToStaticMarkup(h(MemoryRouter,null,h(AppHeader,{...base,...props})));
test('employee navigation exposes lunch and catering, with a working profile route',()=>{
  const html=header({});assert.match(html,/Min plan/);assert.match(html,/Forplejning/);assert.match(html,/href="\/\?tab=profile"/);assert.doesNotMatch(html,/>Køkken<|>Admin</);
});
test('kitchen navigation does not expose administration',()=>{
  const html=header({canAccessKitchen:true});assert.match(html,/>Køkken</);assert.doesNotMatch(html,/>Admin</);
});
test('admin keeps both privileged navigation entries',()=>{
  const html=header({isAdmin:true,canAccessKitchen:true});assert.match(html,/>Køkken</);assert.match(html,/>Admin</);
});
test('active catering link announces its current page',()=>{
  const html=header({activeTab:'outlook'});assert.match(html,/aria-current="page"[^>]*href="\/\?tab=outlook"/);assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
});
test('logout is disabled before login and while submitting',()=>{
  for(const props of [{signedIn:false},{loading:true},{loggingOut:true}]) assert.match(header(props),/aria-label="Log ud" disabled/);
});
const page=props=>renderToStaticMarkup(h(AppSession.Provider,{value:{user:{id:'test',email:'test@example.invalid'},isLoading:false,isAdmin:false,canAccessKitchen:false,activeTab:'calendar',...props}},h(Index)));
test('direct admin and kitchen links cannot render privileged content for employees',()=>{
  assert.doesNotMatch(page({activeTab:'admin'}),/AdminPanel/);assert.doesNotMatch(page({activeTab:'kitchen'}),/KitchenView/);
});
test('authorized roles still render their existing screens',()=>{
  assert.match(page({activeTab:'admin',isAdmin:true}),/AdminPanel/);assert.match(page({activeTab:'kitchen',canAccessKitchen:true}),/KitchenView/);
});
test('profile and loading keep the existing sign-in boundary',()=>{
  assert.match(page({activeTab:'profile'}),/ProfileSettings/);assert.match(page({user:null}),/AuthForm/);assert.doesNotMatch(page({isLoading:true,activeTab:'admin',isAdmin:true}),/AdminPanel/);
});
