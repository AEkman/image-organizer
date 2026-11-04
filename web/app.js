const $ = id => document.getElementById(id);
const path = $('path'), suggestions = $('suggestions'), grid = $('grid'), dialog = $('shortcuts');
let choices = [], selected = -1, current = '', parent = '', request = 0, timer, folderRequest = 0;
const marked = new Set();
const rejected = new Set();
let selectionAnchor = -1, rangeSelection, hoveredTile;
function resetSelectionRange(){rangeSelection=undefined;}
function applySelectionRange(view,values,anchor,end){
 if(!rangeSelection||rangeSelection.view!==view)rangeSelection={view,anchor,base:new Set(marked)};
 marked.clear();for(const value of rangeSelection.base)marked.add(value);
 for(let i=Math.min(rangeSelection.anchor,end);i<=Math.max(rangeSelection.anchor,end);i++){if(values[i]){if(rangeSelection.base.has(values[i]))marked.delete(values[i]);else marked.add(values[i]);}}
}
document.addEventListener('keyup',event=>{if(event.key==='Shift')resetSelectionRange();});
function refreshSelection(){
 for(const tile of grid.querySelectorAll('.tile')){
  if(!tile.dataset.imagePath)continue;
  const active=marked.has(tile.dataset.imagePath);
  tile.classList.toggle('rejected',rejected.has(tile.dataset.imagePath));
  tile.classList.toggle('selected',active);tile.setAttribute('aria-pressed',active);
 }
 $('compare').disabled=marked.size<2;
 $('deleteRejected').disabled=rejected.size===0;
 $('reviewDeleteRejected').disabled=rejected.size===0;
 $('rejectionCount').textContent=`${rejected.size} rejected across all folders`;
 $('reviewRejectionCount').textContent=`${rejected.size} rejected across all folders`;
 $('selectionCount').textContent=`${marked.size} selected`;
 $('reviewSelectionCount').textContent=`${marked.size} selected`;
}
function selectRange(index, fallback=selectionAnchor<0?index:selectionAnchor){
 const tiles=[...grid.querySelectorAll('.tile')];
 applySelectionRange('grid',tiles.map(tile=>tile.dataset.imagePath),fallback,index);
 refreshSelection();
}
function toggleSelection(tile){
 const value=tile.dataset.imagePath;if(!value)return;resetSelectionRange();
 if(marked.has(value))marked.delete(value);else marked.add(value);
 selectionAnchor=[...grid.querySelectorAll('.tile')].indexOf(tile);
 refreshSelection();
}
const natural = new Intl.Collator(undefined, {numeric:true,sensitivity:'base'});
const sort = entries => entries.sort((a,b)=>Number(b.folder)-Number(a.folder)||natural.compare(a.name,b.name));
async function listing(value) {
 const response = await fetch('/api/folder?'+new URLSearchParams({path:value}));
 if (!response.ok) throw new Error(await response.text());
 return response.json();
}
function clearSuggestions(){clearTimeout(timer);request++;choices=[];selected=-1;suggestions.replaceChildren();}
function paintSuggestions(){
 suggestions.replaceChildren();
 choices.forEach((entry,index)=>{const button=document.createElement('button');button.type='button';button.textContent='▸ '+entry.name+'/';button.classList.toggle('active',index===selected);button.onclick=()=>accept(index);suggestions.append(button);});
}
function accept(index){if(!choices.length)return;path.value=choices[index].path+'/';clearSuggestions();path.focus();suggest();}
async function suggest(){
 const version=++request, value=path.value, split=value.lastIndexOf('/');
 const directory=split<0?'~':value.slice(0,split+1), prefix=split<0?value:value.slice(split+1);
 try {const data=await listing(directory);if(version!==request)return;
 choices=sort(data.entries.filter(entry=>entry.folder&&entry.name.toLowerCase().startsWith(prefix.toLowerCase())));selected=-1;paintSuggestions();
 }catch{if(version===request){choices=[];paintSuggestions();}}
}
async function openFolder(value){
 const version=++folderRequest;clearSuggestions();$('status').textContent='Opening folder…';
 try{const data=await listing(value);if(version!==folderRequest)return;
 current=data.path;parent=data.parent;path.value=current+'/';$('title').textContent=current.split('/').filter(Boolean).pop()||'/';
 let firstImage, firstFolder;
 const entries=sort(data.entries);$('status').textContent=`${entries.filter(e=>!e.folder).length} images · ${entries.filter(e=>e.folder).length} folders · ${current}`;
 $('parent').hidden=parent===current;selectionAnchor=-1;resetSelectionRange();hoveredTile=undefined;grid.replaceChildren();
 for(const entry of entries){const tile=document.createElement('button');tile.type='button';tile.className='tile';tile.title=entry.name;
 if(entry.folder){firstFolder ??= tile;const art=document.createElement('span');art.className='folder-art';art.textContent='▱';tile.append(art);tile.onclick=()=>openFolder(entry.path);}
 else{tile.addEventListener('pointerleave',()=>{if(hoveredTile===tile)hoveredTile=undefined;});tile.addEventListener('pointerenter',event=>{hoveredTile=tile;if(!event.shiftKey)return;const tiles=[...grid.querySelectorAll('.tile')];selectRange(tiles.indexOf(tile),Math.max(0,tiles.indexOf(document.activeElement)));tile.focus();});tile.dataset.imagePath=entry.path;tile.setAttribute('aria-pressed','false');tile.onclick=(event)=>{tile.focus();if(event?.shiftKey)selectRange([...grid.querySelectorAll('.tile')].indexOf(tile));else toggleSelection(tile);};firstImage ??= tile;const image=document.createElement('img');image.loading='lazy';image.src='/api/image?'+new URLSearchParams({path:entry.path});image.alt=entry.name;image.onerror=()=>{image.alt='Cannot display '+entry.name;};tile.append(image);}
 const caption=document.createElement('span');caption.className='caption';caption.textContent=entry.name;tile.append(caption);grid.append(tile);}
 refreshSelection();
 (firstImage ?? firstFolder ?? path).focus();
 if(!entries.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No supported images or subfolders here.';grid.append(empty);}
 }catch(error){if(version===folderRequest)$('status').textContent=error.message;}
}
$('open').onsubmit=event=>{event.preventDefault();openFolder(path.value);};
path.addEventListener('input',()=>{clearSuggestions();timer=setTimeout(suggest,120);});
path.addEventListener('keydown',event=>{
 if(event.key==='Escape'){clearSuggestions();return;}
 if((event.key==='Tab'||event.key==='ArrowDown'||event.key==='ArrowUp')&&choices.length){event.preventDefault();
 if(event.key==='Tab'){accept(selected<0?(event.shiftKey?choices.length-1:0):selected);return;}
 selected=selected<0?(event.key==='ArrowDown'?0:choices.length-1):(selected+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length;paintSuggestions();
 }else if(event.key==='Enter'&&selected>=0){event.preventDefault();accept(selected);}
});
$('parent').onclick=()=>openFolder(parent);
dialog.addEventListener('click',event=>{
 if(event.target!==dialog)return;
 const bounds=dialog.getBoundingClientRect();
 if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
});
$('help').onclick=()=>{if(!dialog.open)dialog.showModal();};$('closeHelp').onclick=()=>dialog.close();
document.addEventListener('keydown',event=>{
 if($('deletions').open&&!dialog.open){
 if(deleting)return;
 if(event.key==='t'){event.preventDefault();$('dryRun').checked=!$('dryRun').checked;updateDeleteAction();}
 if(event.key==='x'&&event.target.dataset?.deletionPath){event.preventDefault();unmarkDeletion(event.target.dataset.deletionPath);}
 return;
 }
 if(event.target.matches('input,textarea'))return;
 if(event.key==='?'||(event.shiftKey&&event.code==='Slash')){event.preventDefault();if(!dialog.open)dialog.showModal();return;}
 if(dialog.open)return;
 if(event.key==='d'){event.preventDefault();openDeletions();return;}
 if(!$('review').hidden){
 if(!$('selectionOverview').hidden){handleOverviewKey(event);return;}
 const commands={a:toggleOverview,s:toggleSideBySide,p:pinImage,x:()=>toggleRejection(comparison[reviewIndex]),Escape:leaveComparison,h:()=>moveReview(-1),l:()=>moveReview(1),ArrowLeft:()=>moveReview(-1),ArrowRight:()=>moveReview(1)};
 if(commands[event.key]){event.preventDefault();commands[event.key]();}return;
 }
 if(event.key==='Escape'){event.preventDefault();marked.clear();selectionAnchor=-1;resetSelectionRange();refreshSelection();return;}
 if(event.key==='c'){event.preventDefault();enterComparison();return;}
 if(event.key==='/'){event.preventDefault();path.focus();return;}
 if(event.key==='Backspace'&&current){event.preventDefault();openFolder(parent);return;}
 const tiles=[...grid.querySelectorAll('.tile')];const index=tiles.indexOf(document.activeElement);
 if(event.key==='Shift'){const start=hoveredTile?tiles.indexOf(hoveredTile):index;if(start>=0&&tiles[start].dataset.imagePath){selectRange(start,start);tiles[start].focus();}return;}
 if((event.key==='x'||event.key==='u')&&(marked.size||tiles[index]?.dataset.imagePath)){event.preventDefault();if(event.key==='x')toggleMarkedRejection(tiles[index]?.dataset.imagePath);else setMarkedRejection(tiles[index]?.dataset.imagePath,false);return;}
 if(event.key==='r'&&tiles[index]?.dataset.imagePath){event.preventDefault();toggleRejection(tiles[index].dataset.imagePath);return;}
 if(event.key===' '&&index>=0&&tiles[index].dataset.imagePath){event.preventDefault();toggleSelection(tiles[index]);return;}
 const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
 const moves={h:-1,l:1,j:columns,k:-columns,ArrowLeft:-1,ArrowRight:1,ArrowDown:columns,ArrowUp:-columns};
 const navigationKey=event.key.length===1?event.key.toLowerCase():event.key;
 if(navigationKey in moves&&tiles.length){hoveredTile=undefined;event.preventDefault();const next=Math.max(0,Math.min(tiles.length-1,index<0?0:index+moves[navigationKey]));if(event.shiftKey)selectRange(next,Math.max(0,index));else{selectionAnchor=next;resetSelectionRange();}tiles[next].focus();}
});
path.value='~/Downloads/';path.focus();suggest();

$('compare').disabled=true;
let comparison=[], reviewIndex=0, returnFocus, sideBySide=false, reference;
function paintReview(){
 const value=comparison[reviewIndex];
 $('allSelections').setAttribute('aria-pressed',!$('selectionOverview').hidden);
 $('referencePane').hidden=!sideBySide;
 $('comparisonPanes').classList.toggle('side-by-side',sideBySide);
 $('sideBySide').setAttribute('aria-pressed',sideBySide);
 $('sideBySide').disabled=comparison.filter(value=>!rejected.has(value)).length<2&&!sideBySide;
 $('pinImage').hidden=!sideBySide;
 if(sideBySide){$('referenceImage').src='/api/image?'+new URLSearchParams({path:reference});$('referenceImage').alt=reference.split('/').pop();$('referenceName').textContent='Pinned · '+reference.split('/').pop();}
 $('reviewImage').src='/api/image?'+new URLSearchParams({path:value});
 $('reviewImage').alt=value.split('/').pop();
 $('reviewImage').classList.toggle('rejected',rejected.has(value));
 $('rejectImage').setAttribute('aria-pressed',rejected.has(value));
 $('rejectImage').textContent=rejected.has(value)?'Keep image (x)':'Reject image (x)';
 $('reviewName').textContent=value.split('/').pop();
 $('reviewPosition').textContent=`${reviewIndex+1} / ${comparison.length}`;
 if(!$('selectionOverview').hidden)paintOverview();
}
function enterComparison(){
 if(marked.size<2)return;
 returnFocus=document.activeElement;
 comparison=[...marked].sort(natural.compare);
 $('selectionOverview').hidden=true;reviewIndex=0;sideBySide=false;reference=undefined;$('browser').hidden=true;$('review').hidden=false;paintReview();$('nextImage').focus();
}
function leaveComparison(){
 $('allSelections').setAttribute('aria-pressed',false);
 $('selectionOverview').hidden=true;
 $('review').hidden=true;$('browser').hidden=false;
 const tiles=[...grid.querySelectorAll('.tile')];
 const focusTarget=tiles.includes(returnFocus)?returnFocus:tiles.find(tile=>marked.has(tile.dataset.imagePath))??path;
 marked.clear();selectionAnchor=-1;resetSelectionRange();refreshSelection();
 focusTarget.focus();
}
function toggleRejection(value){
 if(rejected.has(value))rejected.delete(value);else rejected.add(value);
 updateRejectionView();
}
function toggleMarkedRejection(fallback){
 const values=marked.size?[...marked]:[fallback].filter(Boolean);
 setMarkedRejection(fallback,!values.every(value=>rejected.has(value)));
}
function setMarkedRejection(fallback,reject){
 const values=marked.size?[...marked]:[fallback].filter(Boolean);
 for(const value of values){if(reject)rejected.add(value);else rejected.delete(value);}
 updateRejectionView();
}
function updateRejectionView(){
 if(reference&&rejected.has(reference)){sideBySide=false;reference=undefined;}
 if(sideBySide&&rejected.has(comparison[reviewIndex])){
  const next=comparison.slice(reviewIndex+1).concat(comparison.slice(0,reviewIndex+1)).find(candidate=>candidate!==reference&&!rejected.has(candidate));
  if(next)reviewIndex=comparison.indexOf(next);
  else{sideBySide=false;reviewIndex=comparison.indexOf(reference);}
 }
 refreshSelection();if(!$('review').hidden)paintReview();
}
$('rejectImage').onclick=()=>toggleRejection(comparison[reviewIndex]);
function alternatives(){return comparison.filter(value=>value!==reference&&!rejected.has(value));}
function toggleSideBySide(){
 if(sideBySide){sideBySide=false;paintReview();return;}
 const survivors=comparison.filter(value=>!rejected.has(value));if(survivors.length<2)return;
 reference=survivors.includes(comparison[reviewIndex])?comparison[reviewIndex]:survivors[0];
 reviewIndex=comparison.indexOf(survivors.find(value=>value!==reference));sideBySide=true;paintReview();
}
function pinImage(){if(!sideBySide)return;reference=comparison[reviewIndex];reviewIndex=comparison.indexOf(alternatives()[0]);paintReview();}
function moveReview(step){
 if(sideBySide){const candidates=alternatives();const index=candidates.indexOf(comparison[reviewIndex]);reviewIndex=comparison.indexOf(candidates[(index+step+candidates.length)%candidates.length]);}
 else reviewIndex=(reviewIndex+step+comparison.length)%comparison.length;
 paintReview();
}
$('sideBySide').onclick=toggleSideBySide;
$('pinImage').onclick=pinImage;
$('review').hidden=true;
$('compare').onclick=enterComparison;
$('backToGrid').onclick=leaveComparison;
$('nextImage').onclick=()=>moveReview(1);
$('previousImage').onclick=()=>moveReview(-1);

let overviewFocus;
function paintOverview(){
 const focused=document.activeElement?.dataset?.overviewPath;
 $('overviewGrid').replaceChildren();
 for(const value of comparison){
  const tile=document.createElement('button');tile.type='button';tile.className='tile';tile.title=value;tile.dataset.overviewPath=value;
  tile.classList.toggle('selected',marked.has(value));tile.classList.toggle('rejected',rejected.has(value));
  tile.classList.toggle('pinned',value===reference);tile.classList.toggle('current',value===comparison[reviewIndex]);
  const image=document.createElement('img');image.loading='lazy';image.src='/api/image?'+new URLSearchParams({path:value});image.alt=value.split('/').pop();tile.append(image);
  const label=document.createElement('span');label.className='caption';label.textContent=value.split('/').pop();tile.append(label);
  const state=document.createElement('span');state.className='state-label';
  state.textContent=[marked.has(value)?'Selected':'',rejected.has(value)?'Rejected':'Kept',value===reference?'Pinned':'',value===comparison[reviewIndex]?'Current':''].filter(Boolean).join(' · ');tile.append(state);
  tile.onclick=()=>{resetSelectionRange();overviewFocus=value;tile.focus();};
  tile.onfocus=()=>{overviewFocus=value;};
  $('overviewGrid').append(tile);
  if(focused===value)tile.focus();
 }
}
function toggleOverview(){
 resetSelectionRange();
 const show=$('selectionOverview').hidden;$('selectionOverview').hidden=!show;
 $('allSelections').setAttribute('aria-pressed',show);
 if(show){marked.clear();selectionAnchor=-1;refreshSelection();overviewFocus=comparison[0];paintOverview();const tiles=[...$('overviewGrid').querySelectorAll('.tile')];(tiles.find(tile=>tile.dataset.overviewPath===overviewFocus)??$('closeOverview')).focus();}else $('allSelections').focus();
}
$('selectionOverview').hidden=true;
$('allSelections').onclick=toggleOverview;
$('closeOverview').onclick=toggleOverview;

function overviewValue(){return document.activeElement?.dataset?.overviewPath??overviewFocus;}
function editOverview(action){
 const value=overviewValue();if(!value)return;
 if(action==='reject')toggleRejection(value);
 if(action==='select'){resetSelectionRange();if(marked.has(value))marked.delete(value);else marked.add(value);refreshSelection();paintReview();}
 if(action==='pin'&&!rejected.has(value)){
  reference=value;const candidates=alternatives();sideBySide=candidates.length>0;
  reviewIndex=comparison.indexOf(candidates[0]??value);paintReview();
 }
}
function handleOverviewKey(event){
 if(event.key==='Enter'){event.preventDefault();leaveComparison();return;}
 if(event.key===' '&&!event.target.dataset?.overviewPath)return;
 const commands={a:toggleOverview,Escape:toggleOverview,x:()=>toggleMarkedRejection(overviewValue()),u:()=>setMarkedRejection(overviewValue(),false),r:()=>editOverview('reject'),' ':()=>editOverview('select'),p:()=>editOverview('pin')};
 if(commands[event.key]){event.preventDefault();commands[event.key]();return;}
 const tiles=[...$('overviewGrid').querySelectorAll('.tile')];const index=tiles.indexOf(document.activeElement);
 if(event.key==='Shift'&&index>=0){applySelectionRange('overview',tiles.map(tile=>tile.dataset.overviewPath),index,index);refreshSelection();paintReview();return;}
 const columns=getComputedStyle($('overviewGrid')).gridTemplateColumns.split(' ').length;
 const moves={h:-1,l:1,j:columns,k:-columns,ArrowLeft:-1,ArrowRight:1,ArrowDown:columns,ArrowUp:-columns};
 const navigationKey=event.key.length===1?event.key.toLowerCase():event.key;
 if(navigationKey in moves&&tiles.length){
 event.preventDefault();const next=Math.max(0,Math.min(tiles.length-1,index<0?0:index+moves[navigationKey]));
 overviewFocus=tiles[next].dataset.overviewPath;
 if(event.shiftKey){applySelectionRange('overview',tiles.map(tile=>tile.dataset.overviewPath),Math.max(0,index),next);refreshSelection();paintReview();}else resetSelectionRange();
 [...$('overviewGrid').querySelectorAll('.tile')][next].focus();
 }
}
$('overviewReject').onclick=()=>toggleMarkedRejection(overviewValue());
$('overviewSelect').onclick=()=>editOverview('select');
$('overviewPin').onclick=()=>editOverview('pin');

$('overviewBackToGrid').onclick=leaveComparison;

let deletionPaths=[], deletionResults=new Map(), deleting=false;
function updateDeleteAction(){
 $('runDeletion').textContent=$('dryRun').checked?'Run dry-run (no file changes)':'Move rejected files to Trash';
 $('runDeletion').disabled=deleting||deletionPaths.length===0;
}
function renderDeletions(){
 $('deletionList').replaceChildren();
 for(const value of deletionPaths){
  const row=document.createElement('div');row.className='deletion-row';
  const image=document.createElement('img');image.src='/api/image?'+new URLSearchParams({path:value});image.alt=value.split('/').pop();image.loading='lazy';row.append(image);
  const label=document.createElement('span');label.textContent=value;
  const result=deletionResults.get(value);if(result)label.textContent+=' — '+(result.error??(result.status==='dry-run'?'Would move to Trash; file unchanged':result.status));row.append(label);
  const keep=document.createElement('button');keep.type='button';keep.textContent='Keep';keep.dataset.deletionPath=value;keep.disabled=deleting;keep.onclick=()=>unmarkDeletion(value);row.append(keep);$('deletionList').append(row);
 }
 $('deletionTotal').textContent=`${deletionPaths.length} rejected files across all folders`;
 updateDeleteAction();
}
function unmarkDeletion(value){
 if(deleting)return;rejected.delete(value);deletionPaths=deletionPaths.filter(path=>path!==value);refreshSelection();renderDeletions();
 if(!$('review').hidden)paintReview();
 $('runDeletion').focus();
}
function openDeletions(){
 if(!rejected.size)return;
 deletionPaths=[...rejected].sort(natural.compare);deletionResults.clear();$('dryRun').checked=true;$('deletionReport').textContent='Preview only. No files have been changed.';
 renderDeletions();$('deletions').showModal();$('runDeletion').focus();
}
async function runDeletion(){
 if(deleting||!deletionPaths.length)return;
 const paths=[...deletionPaths],dryRun=$('dryRun').checked;
 deleting=true;$('dryRun').disabled=true;$('closeDeletions').disabled=true;renderDeletions();
 $('deletionReport').textContent=dryRun?'Checking files…':'Moving files to macOS Trash…';
 try{
  const response=await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths,dryRun})});
  if(!response.ok)throw new Error(await response.text());
  const data=await response.json();const moved=new Set();let errors=0;
  for(const result of data.results){
   if(!paths.includes(result.path))continue;
   deletionResults.set(result.path,result);
   if(!dryRun&&result.status==='trashed'){moved.add(result.path);rejected.delete(result.path);marked.delete(result.path);}
   if(result.status==='error')errors++;
  }
  if(moved.size){
   const remaining=[...grid.querySelectorAll('.tile')].filter(tile=>!moved.has(tile.dataset.imagePath));
   grid.replaceChildren(...remaining);
   $('status').textContent=`${remaining.filter(tile=>tile.dataset.imagePath).length} images · ${remaining.filter(tile=>!tile.dataset.imagePath).length} folders · ${current}`;
   selectionAnchor=-1;resetSelectionRange();deletionPaths=deletionPaths.filter(value=>!moved.has(value));
   comparison=comparison.filter(value=>!moved.has(value));sideBySide=false;if(moved.has(reference))reference=undefined;
   if(!$('review').hidden){if(!comparison.length)leaveComparison();else{reviewIndex=Math.min(reviewIndex,comparison.length-1);paintReview();}}
  }
  refreshSelection();
  $('deletionReport').textContent=dryRun?`Dry-run complete. No files changed. ${errors} errors.`:`${moved.size} files moved to Trash. ${errors} errors; failed files remain rejected.`;
 }catch(error){$('deletionReport').textContent='Deletion failed: '+error.message;}
 finally{deleting=false;$('dryRun').disabled=false;$('closeDeletions').disabled=false;renderDeletions();}
}
$('deleteRejected').onclick=openDeletions;
$('reviewDeleteRejected').onclick=openDeletions;
$('closeDeletions').onclick=()=>{if(!deleting)$('deletions').close();};
$('deletions').addEventListener('cancel',event=>{if(deleting)event.preventDefault();});
$('dryRun').addEventListener('change',updateDeleteAction);
$('runDeletion').onclick=runDeletion;
$('deleteRejected').disabled=true;$('reviewDeleteRejected').disabled=true;
