const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function setup(){
 const elements=new Map(), handlers={};
 const element=(tag='div')=>({tag,value:'',open:false,showModal(){this.open=true},close(){this.open=false},dataset:{},attributes:{},setAttribute(key,value){this.attributes[key]=String(value)},getAttribute(key){return this.attributes[key]},children:[],handlers:{},addEventListener(k,f){this.handlers[k]=f},replaceChildren(...children){this.children=children},append(child){this.children.push(child)},focus(){document.activeElement=this},classList:{values:new Set(),toggle(name,on){if(on)this.values.add(name);else this.values.delete(name)},contains(name){return this.values.has(name)}},matches(selector){return this.tag==='input'},querySelectorAll(){return this.children.filter(child=>child.className==='tile')}});
 const document={activeElement:null,getElementById(id){if(!elements.has(id))elements.set(id,element(id==='path'?'input':'div'));return elements.get(id)},createElement:element,addEventListener(key,handler){handlers[key]=handler}};
 const context=vm.createContext({document,Intl,URLSearchParams,fetch:()=>new Promise(()=>{}),setTimeout:()=>1,clearTimeout(){},getComputedStyle:()=>({gridTemplateColumns:'180px 180px'})});
 vm.runInContext(fs.readFileSync('web/app.js','utf8'),context);
 return {context,elements,document,handlers};
}
async function openFixture(fixture){
 const state=setup();state.context.fetch=async()=>({ok:true,json:async()=>({path:'/photos',parent:'/',entries:fixture})});
 await vm.runInContext("openFolder('/photos')",state.context);return state;
}
test('editing a path prevents Tab accepting suggestions from the previous prefix',()=>{const {context,elements}=setup();vm.runInContext("choices=[{name:'old',path:'/old'}]",context);const input=elements.get('path');input.value='/new';input.handlers.input();input.handlers.keydown({key:'Tab',preventDefault(){}});assert.equal(input.value,'/new');});
test('ArrowUp initially selects the last folder suggestion',()=>{const {context,elements}=setup();vm.runInContext("choices=[{name:'a',path:'/a'},{name:'b',path:'/b'},{name:'c',path:'/c'}]",context);elements.get('path').handlers.keydown({key:'ArrowUp',preventDefault(){}});assert.equal(vm.runInContext('selected',context),2);});

test('opening a folder focuses its first image rather than an earlier folder tile',async()=>{
 const state=await openFixture([{name:'nested',path:'/photos/nested',folder:true},{name:'a.jpg',path:'/photos/a.jpg',folder:false}]);
 assert.equal(state.document.activeElement.title,'a.jpg');
});

test('hjkl navigates thumbnails immediately after opening a folder',async()=>{
 const state=await openFixture(['a','b','c','d'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const [key,expected] of [['l','b.jpg'],['j','d.jpg'],['h','c.jpg'],['k','a.jpg']]){
  state.handlers.keydown({key,target:state.document.activeElement,preventDefault(){}});
  assert.equal(state.document.activeElement.title,expected);
 }
});
test('folder-only and empty directories leave a useful focus target',async()=>{
 const folders=await openFixture([{name:'nested',path:'/photos/nested',folder:true}]);assert.equal(folders.document.activeElement.title,'nested');
 const empty=await openFixture([]);assert.equal(empty.document.activeElement,empty.elements.get('path'));
});

test('Space toggles image selection without moving focus or selecting folders',async()=>{
 const state=await openFixture([{name:'nested',path:'/photos/nested',folder:true},{name:'a.jpg',path:'/photos/a.jpg',folder:false}]);
 const image=state.document.activeElement;
 const press=()=>state.handlers.keydown({key:' ',target:state.document.activeElement,preventDefault(){}});
 press();assert.equal(image.getAttribute('aria-pressed'),'true');assert.equal(state.document.activeElement,image);
 press();assert.equal(image.getAttribute('aria-pressed'),'false');
 const folder=state.elements.get('grid').children[0];folder.focus();press();assert.notEqual(folder.getAttribute('aria-pressed'),'true');
});

test('Shift navigation selects a range and Shift click extends it',async()=>{
 const state=await openFixture(['a','b','c','d'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;
 state.handlers.keydown({key:'L',shiftKey:true,target:state.document.activeElement,preventDefault(){}});
 assert.equal(tiles[0].getAttribute('aria-pressed'),'true');assert.equal(tiles[1].getAttribute('aria-pressed'),'true');
 tiles[3].onclick({shiftKey:true});assert.ok(tiles.every(tile=>tile.getAttribute('aria-pressed')==='true'));
});

test('Compare opens only selected images and Escape restores grid focus',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;
 tiles[0].onclick({});tiles[2].onclick({});tiles[0].focus();
 assert.equal(state.elements.get('compare').disabled,false);
 state.elements.get('compare').onclick();
 assert.equal(state.elements.get('review').hidden,false);
 assert.match(state.elements.get('reviewImage').src,/a.jpg/);
 state.handlers.keydown({key:'l',target:state.document.activeElement,preventDefault(){}});
 assert.match(state.elements.get('reviewImage').src,/c.jpg/);
 state.handlers.keydown({key:'Escape',target:state.document.activeElement,preventDefault(){}});
 assert.equal(state.elements.get('review').hidden,true);assert.equal(state.document.activeElement,tiles[0]);
 assert.equal(tiles[2].getAttribute('aria-pressed'),'false');
 assert.equal(state.elements.get('selectionCount').textContent,'0 selected');
 assert.equal(state.elements.get('compare').disabled,true);
});

test('reject toggles current image without advancing and survives returning to grid',async()=>{
 const state=await openFixture(['a','b'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();
 const src=state.elements.get('reviewImage').src;
 state.handlers.keydown({key:'x',target:state.document.activeElement,preventDefault(){}});
 assert.equal(state.elements.get('rejectImage')?.getAttribute('aria-pressed'),'true');assert.equal(state.elements.get('reviewImage').src,src);
 state.handlers.keydown({key:'x',target:state.document.activeElement,preventDefault(){}});
 assert.equal(state.elements.get('rejectImage').getAttribute('aria-pressed'),'false');
 state.handlers.keydown({key:'x',target:state.document.activeElement,preventDefault(){}});
 state.handlers.keydown({key:'Escape',target:state.document.activeElement,preventDefault(){}});
 const tiles=state.elements.get('grid').children;
 assert.equal(tiles[0].classList.contains('rejected'),true);
 assert.ok(tiles.every(tile=>!tile.classList.contains('selected')));
 for(const tile of tiles)tile.onclick({});state.elements.get('compare').onclick();
 assert.equal(state.elements.get('rejectImage').getAttribute('aria-pressed'),'true');
});

test('side-by-side pins a reference and cycles only unrejected alternatives',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();
 const key=key=>state.handlers.keydown({key,target:state.document.activeElement,preventDefault(){}});
 key('s');assert.equal(state.elements.get('referencePane')?.hidden,false);
 assert.match(state.elements.get('referenceImage').src,/a.jpg/);assert.match(state.elements.get('reviewImage').src,/b.jpg/);
 key('l');assert.match(state.elements.get('reviewImage').src,/c.jpg/);assert.match(state.elements.get('referenceImage').src,/a.jpg/);
 key('p');assert.match(state.elements.get('referenceImage').src,/c.jpg/);
 key('x');assert.equal(state.elements.get('referencePane').hidden,false);
 assert.match(state.elements.get('referenceImage').src,/c.jpg/);assert.match(state.elements.get('reviewImage').src,/b.jpg/);
 key('x');assert.equal(state.elements.get('referencePane').hidden,true);assert.match(state.elements.get('reviewImage').src,/c.jpg/);
});

test('comparison requires two selections and navigation wraps',async()=>{
 const state=await openFixture(['a','b'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;
 assert.equal(state.elements.get('compare').disabled,true);tiles[0].onclick({});state.elements.get('compare').onclick();assert.equal(state.elements.get('review').hidden,true);
 tiles[1].onclick({});state.elements.get('compare').onclick();state.elements.get('previousImage').onclick();assert.match(state.elements.get('reviewImage').src,/b.jpg/);
 state.elements.get('nextImage').onclick();assert.match(state.elements.get('reviewImage').src,/a.jpg/);
});

test('rejection total stays global across folders and restores rejected thumbnail marks',async()=>{
 const fixture=['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false}));
 const state=await openFixture(fixture);
 for(const tile of state.elements.get('grid').children){tile.focus();state.handlers.keydown({key:'r',target:tile,preventDefault(){}});}
 assert.equal(state.document.getElementById('rejectionCount').textContent,'3 rejected across all folders');
 state.context.fetch=async()=>({ok:true,json:async()=>({path:'/other',parent:'/',entries:[]})});await vm.runInContext("openFolder('/other')",state.context);
 assert.equal(state.elements.get('rejectionCount').textContent,'3 rejected across all folders');
 state.context.fetch=async()=>({ok:true,json:async()=>({path:'/photos',parent:'/',entries:fixture})});await vm.runInContext("openFolder('/photos')",state.context);
 assert.equal(state.elements.get('rejectionCount').textContent,'3 rejected across all folders');
 assert.ok(state.elements.get('grid').children.every(tile=>tile.classList.contains('rejected')));
 const tile=state.elements.get('grid').children[0];state.handlers.keydown({key:'r',target:tile,preventDefault(){}});
 assert.equal(state.elements.get('rejectionCount').textContent,'2 rejected across all folders');
});

test('selected and rejected totals survive folder navigation and cross-folder selections can be compared',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});
 const tile=state.elements.get('grid').children[0];state.handlers.keydown({key:'r',target:tile,preventDefault(){}});
 state.context.fetch=async()=>({ok:true,json:async()=>({path:'/other',parent:'/',entries:[]})});await vm.runInContext("openFolder('/other')",state.context);
 assert.equal(state.elements.get('selectionCount').textContent,'3 selected');assert.equal(state.elements.get('rejectionCount').textContent,'1 rejected across all folders');
 state.elements.get('compare').onclick();assert.match(state.elements.get('reviewImage').src,/a.jpg/);
 state.elements.get('backToGrid').onclick();assert.equal(state.elements.get('selectionCount').textContent,'0 selected');assert.equal(state.elements.get('rejectionCount').textContent,'1 rejected across all folders');
});

test('all-selection toggle includes rejected images with pinned and current states',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();
 const key=key=>state.handlers.keydown({key,target:state.document.activeElement,preventDefault(){}});
 key('s');key('x');key('a');
 const overview=state.document.getElementById('selectionOverview');assert.equal(overview.hidden,false);
 const items=state.elements.get('overviewGrid').children;assert.equal(items.length,3);
 assert.equal(items[0].classList.contains('pinned'),true);assert.equal(items[1].classList.contains('rejected'),true);assert.equal(items[2].classList.contains('current'),true);
 key('Escape');assert.equal(overview.hidden,true);assert.equal(state.elements.get('review').hidden,false);
 assert.match(state.elements.get('referenceImage').src,/a.jpg/);
 key('a');state.elements.get('overviewGrid').children[1].onclick();
 assert.equal(overview.hidden,false);
 key('r');assert.equal(state.elements.get('overviewGrid').children[1].classList.contains('rejected'),false);
 key(' ');assert.equal(state.elements.get('overviewGrid').children[1].classList.contains('selected'),true);
 key('p');assert.equal(state.elements.get('overviewGrid').children[1].classList.contains('pinned'),true);
 assert.equal(overview.hidden,false);
});

test('rejecting the pinned image in overview ends the pin and stays editable',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();
 const key=key=>state.handlers.keydown({key,target:state.document.activeElement,preventDefault(){}});
 key('s');key('a');state.elements.get('overviewGrid').children[0].onclick();key('r');
 assert.equal(state.elements.get('referencePane').hidden,true);assert.equal(state.elements.get('selectionOverview').hidden,false);
 assert.equal(state.elements.get('overviewGrid').children[0].classList.contains('pinned'),false);
 key('r');assert.equal(state.elements.get('overviewGrid').children[0].classList.contains('rejected'),false);
});

test('Space on overview action buttons keeps native button activation',async()=>{
 const state=await openFixture(['a','b'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();state.elements.get('allSelections').onclick();
 const button=state.elements.get('overviewReject');button.focus();let consumed=false;
 state.handlers.keydown({key:' ',target:button,preventDefault(){consumed=true;}});
 assert.equal(consumed,false);assert.equal(state.elements.get('selectionCount').textContent,'0 selected');
});

test('Enter in selection overview returns to folder grid and retains rejection marks',async()=>{
 const state=await openFixture(['a','b'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();state.elements.get('allSelections').onclick();
 const key=key=>state.handlers.keydown({key,target:state.document.activeElement,preventDefault(){}});
 key('r');key('Enter');
 assert.equal(state.elements.get('review').hidden,true);assert.equal(state.elements.get('browser').hidden,false);
 assert.equal(state.elements.get('selectionCount').textContent,'0 selected');assert.equal(state.elements.get('rejectionCount').textContent,'1 rejected across all folders');
});

test('deletion preview defaults to dry run and does not clear rejection marks',async()=>{
 const state=await openFixture(['a','b'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children){tile.focus();state.handlers.keydown({key:'r',target:tile,preventDefault(){}});}
 state.document.getElementById('deleteRejected').onclick?.();
 assert.equal(state.document.getElementById('deletions').open,true);assert.equal(state.elements.get('dryRun').checked,true);
 let sent;state.context.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({results:sent.paths.map(path=>({path,status:'dry-run'}))})};};
 await state.elements.get('runDeletion').onclick();
 assert.equal(sent.dryRun,true);assert.equal(sent.paths.length,2);assert.equal(state.elements.get('rejectionCount').textContent,'2 rejected across all folders');
});

test('actual deletion clears only successful moves and retains failed rejections',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;for(const tile of tiles)tile.onclick({});
 for(const tile of tiles.slice(0,2)){tile.focus();state.handlers.keydown({key:'r',target:tile,preventDefault(){}});}
 state.elements.get('deleteRejected').onclick();state.elements.get('dryRun').checked=false;
 state.context.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.dryRun,false);return {ok:true,json:async()=>({results:[{path:'/photos/a.jpg',status:'trashed'},{path:'/photos/b.jpg',status:'error',error:'Permission denied'}]})};};
 await state.elements.get('runDeletion').onclick();
 assert.equal(state.elements.get('rejectionCount').textContent,'1 rejected across all folders');assert.equal(state.elements.get('selectionCount').textContent,'2 selected');
 assert.deepEqual(state.elements.get('grid').children.map(tile=>tile.title),['b.jpg','c.jpg']);
 assert.match(state.elements.get('deletionReport').textContent,/1 files moved to Trash/);
 assert.match(state.elements.get('deletionList').children[0].children[1].textContent,/Permission denied/);
});

test('help closes on backdrop click but remains open for its contents and padding',()=>{
 const state=setup(), help=state.elements.get('shortcuts');help.getBoundingClientRect=()=>({left:100,right:600,top:100,bottom:500});
 state.elements.get('help').onclick();
 help.handlers.click?.({target:help,clientX:120,clientY:120});assert.equal(help.open,true);
 help.handlers.click?.({target:state.elements.get('closeHelp'),clientX:0,clientY:0});assert.equal(help.open,true);
 help.handlers.click?.({target:help,clientX:50,clientY:150});assert.equal(help.open,false);
});

test('Shift navigation in selection overview automatically marks the starting and next images',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();state.elements.get('allSelections').onclick();
 const key=(key,shiftKey=false)=>state.handlers.keydown({key,shiftKey,target:state.document.activeElement,preventDefault(){}});
 state.elements.get('overviewGrid').children[0].onclick();key('L',true);
 const tiles=state.elements.get('overviewGrid').children;
 assert.equal(tiles[0].classList.contains('selected'),true);assert.equal(tiles[1].classList.contains('selected'),true);
 assert.equal(state.document.activeElement,tiles[1]);assert.equal(state.elements.get('selectionCount').textContent,'2 selected');
});

test('x rejects all green-selected images even when another image is focused',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;tiles[0].onclick({});tiles[2].onclick({});tiles[1].focus();
 state.handlers.keydown({key:'x',target:tiles[1],preventDefault(){}});
 assert.equal(tiles[0].classList.contains('rejected'),true);assert.equal(tiles[2].classList.contains('rejected'),true);assert.equal(tiles[1].classList.contains('rejected'),false);
});

test('holding Shift while moving the pointer onto another thumbnail marks it',async()=>{
 const state=await openFixture(['a','b'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;
 tiles[1].handlers.pointerenter?.({shiftKey:true});
 assert.equal(tiles[0].getAttribute('aria-pressed'),'true');assert.equal(tiles[1].getAttribute('aria-pressed'),'true');
});

test('Shift range shrinks backwards while preserving earlier independent selections',async()=>{
 const state=await openFixture(['a','b','c','d'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;tiles[3].onclick({});tiles[0].focus();
 const key=key=>state.handlers.keydown({key,shiftKey:true,target:state.document.activeElement,preventDefault(){}});
 key('L');key('L');key('H');
 assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-pressed')),['true','true','false','true']);
 key('H');assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-pressed')),['true','false','false','true']);
});

test('Escape cancels grid selection and range without removing rejection marks',async()=>{
 const state=await openFixture(['a','b'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;tiles[0].onclick({});
 const key=(key,shiftKey=false)=>state.handlers.keydown({key,shiftKey,target:state.document.activeElement,preventDefault(){}});
 key('r');key('L',true);key('Escape');
 assert.equal(state.elements.get('selectionCount').textContent,'0 selected');assert.equal(tiles[0].classList.contains('rejected'),true);
 key('H',true);assert.equal(state.elements.get('selectionCount').textContent,'2 selected');
});

test('overview Shift range shrinks backwards and releasing Shift commits the previous range',async()=>{
 const state=await openFixture(['a','b','c','d'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();state.elements.get('allSelections').onclick();
 const key=(key,shiftKey=false)=>state.handlers.keydown({key,shiftKey,target:state.document.activeElement,preventDefault(){}});
 state.elements.get('overviewGrid').children[3].onclick();key(' ');
 state.elements.get('overviewGrid').children[0].onclick();key('L',true);key('L',true);key('H',true);
 assert.deepEqual(state.elements.get('overviewGrid').children.map(tile=>tile.classList.contains('selected')),[true,true,false,true]);
 state.handlers.keyup({key:'Shift'});key('L',true);key('H',true);
 assert.deepEqual(state.elements.get('overviewGrid').children.map(tile=>tile.classList.contains('selected')),[true,false,false,true]);
});

test('pressing and holding Shift inverts the original selection across a mixed range',async()=>{
 const state=await openFixture(['a','b','c','d','e'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;
 for(const index of [0,1,2])tiles[index].onclick({});tiles[1].focus();
 const key=key=>state.handlers.keydown({key,shiftKey:true,target:state.document.activeElement,preventDefault(){}});
 key('Shift');assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-pressed')),['true','false','true','false','false']);
 key('Shift');assert.equal(tiles[1].getAttribute('aria-pressed'),'false');
 tiles[4].handlers.pointerenter({shiftKey:true});
 assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-pressed')),['true','false','false','true','true']);
 key('H');assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-pressed')),['true','false','false','true','false']);
 state.handlers.keyup({key:'Shift'});key('Shift');
 assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-pressed')),['true','false','false','false','false']);
});

test('pressing Shift starts at the thumbnail under the pointer',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;for(const tile of tiles)tile.onclick({});
 tiles[1].handlers.pointerenter({shiftKey:false});
 state.handlers.keydown({key:'Shift',shiftKey:true,target:state.document.activeElement,preventDefault(){}});
 assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-pressed')),['true','false','true']);
});

test('x in All selected rejects a mixed selection before toggling the whole selection',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});
 state.elements.get('compare').onclick();state.elements.get('allSelections').onclick();
 for(let i=0;i<3;i++){state.elements.get('overviewGrid').children[i].onclick();state.handlers.keydown({key:' ',target:state.document.activeElement,preventDefault(){}});}
 state.elements.get('overviewGrid').children[1].onclick();
 const press=()=>state.handlers.keydown({key:'x',target:state.document.activeElement,preventDefault(){}});
 state.handlers.keydown({key:'r',target:state.document.activeElement,preventDefault(){}});
 press();
 assert.deepEqual(state.elements.get('overviewGrid').children.map(tile=>tile.classList.contains('rejected')),[true,true,true]);
 press();
 assert.deepEqual(state.elements.get('overviewGrid').children.map(tile=>tile.classList.contains('rejected')),[false,false,false]);
 assert.equal(state.document.activeElement.dataset.overviewPath,'/photos/b.jpg');
 press();
 assert.deepEqual(state.elements.get('overviewGrid').children.map(tile=>tile.classList.contains('rejected')),[true,true,true]);
});

test('grid x rejects mixed selected images then restores all, leaving others unchanged',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 const tiles=state.elements.get('grid').children;tiles[0].onclick({});tiles[1].onclick({});
 const key=key=>state.handlers.keydown({key,target:state.document.activeElement,preventDefault(){}});
 key('r');tiles[2].focus();key('r');
 key('x');assert.deepEqual(tiles.map(tile=>tile.classList.contains('rejected')),[true,true,true]);
 key('x');assert.deepEqual(tiles.map(tile=>tile.classList.contains('rejected')),[false,false,true]);
});

test('overview rejection button toggles selection and x falls back to focus without selection',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});
 state.elements.get('compare').onclick();state.elements.get('allSelections').onclick();
 const key=key=>state.handlers.keydown({key,target:state.document.activeElement,preventDefault(){}});
 for(let i=0;i<3;i++){state.elements.get('overviewGrid').children[i].onclick();key(' ');}
 state.elements.get('overviewReject').onclick();
 assert.deepEqual(state.elements.get('overviewGrid').children.map(tile=>tile.classList.contains('rejected')),[true,true,true]);
 state.elements.get('overviewReject').onclick();
 for(let i=0;i<3;i++){state.elements.get('overviewGrid').children[i].onclick();key(' ');}
 state.elements.get('overviewGrid').children[1].onclick();key('x');
 assert.deepEqual(state.elements.get('overviewGrid').children.map(tile=>tile.classList.contains('rejected')),[false,true,false]);
 key('x');assert.deepEqual(state.elements.get('overviewGrid').children.map(tile=>tile.classList.contains('rejected')),[false,false,false]);
});

test('All selected opens and reopens with no selection and focus on the first image',async()=>{
 const state=await openFixture(['a','b','c'].map(name=>({name:name+'.jpg',path:'/photos/'+name+'.jpg',folder:false})));
 for(const tile of state.elements.get('grid').children)tile.onclick({});state.elements.get('compare').onclick();
 const key=key=>state.handlers.keydown({key,target:state.document.activeElement,preventDefault(){}});
 key('l');key('x');key('a');
 for(let attempt=0;attempt<2;attempt++){
  const tiles=state.elements.get('overviewGrid').children;
  assert.equal(tiles.length,3);
  assert.deepEqual(tiles.map(tile=>tile.classList.contains('selected')),[false,false,false]);
  assert.equal(state.elements.get('selectionCount').textContent,'0 selected');
  assert.equal(state.document.activeElement,tiles[0]);
  assert.equal(tiles[1].classList.contains('rejected'),true);
  if(!attempt){tiles[2].onclick();key(' ');key('a');key('a');}
 }
});
