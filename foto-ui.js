'use strict';

const photoDialog=$('#camera-dialog');
const cameraVideo=$('#camera-video');
const scanButton=$('#run-scan');
const photoResults=$('#photo-results');
let selectedPhoto;
let selectedUrl;
let photoVersion=0;
let cameraVersion=0;
let cameraStream;

function setMode(photo) {
  $('#mode-photo').setAttribute('aria-pressed',String(photo));
  $('#mode-description').setAttribute('aria-pressed',String(!photo));
  $('#photo-panel').hidden=!photo;
  $('#description-panel').hidden=photo;
}

function clearPhoto() {
  photoVersion++;
  if (selectedUrl?.startsWith('blob:')) URL.revokeObjectURL(selectedUrl);
  selectedUrl=undefined;
  selectedPhoto=undefined;
  $('#query-image').removeAttribute('src');
  $('#photo-preview').hidden=true;
  $('#photo-status').textContent='';
  photoResults.replaceChildren();
  scanButton.disabled=false;
  $('#photo-file').value='';
}

async function selectPhoto(source) {
  clearPhoto();
  const version=photoVersion;
  selectedUrl=source;
  try {
    const image=await ReencontroFotos.loadImage(source);
    if (version!==photoVersion) return;
    if (Math.min(image.naturalWidth,image.naturalHeight)<64) throw new Error('Escolha uma imagem com pelo menos 64 pixels em cada lado.');
    selectedPhoto=image;
    $('#query-image').src=source;
    $('#photo-preview').hidden=false;
    $('#photo-status').textContent='Imagem pronta para comparação.';
  } catch(error) {
    if (version!==photoVersion) return;
    clearPhoto();
    $('#photo-status').textContent=error.message;
  }
}

function sampleWithoutMatch() {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#173a4a';
  ctx.fillRect(0,0,256,256);
  ctx.fillStyle='#f3d576';
  for(let i=0;i<8;i++) ctx.fillRect(i*32,(i%2)*64,16,150);
  return canvas.toDataURL('image/png');
}

async function scan() {
  if (!selectedPhoto) return;
  const version=photoVersion;
  scanButton.disabled=true;
  photoResults.replaceChildren();
  $('#photo-status').textContent='Comparando a foto com a base fictícia…';
  try {
    const matches=await ReencontroFotos.search(selectedPhoto,cases);
    if (version!==photoVersion) return;
    if (matches.length) {
      const cards=matches.map(match => {
        const record=byId.get(match.id);
        return `<article class="case-card"><img src="${escape(match.src)}" alt="Imagem candidata"><div><small>${record.id} · ${record.data.slice(0,4)}</small><h3>${escape(record.nome)}</h3><small>${escape(record.zona)} · ${record.idade} anos na época</small></div><button class="quiet" type="button" data-match="${record.id}">Pode ser a pessoa · ver ficha</button></article>`;
      }).join('');
      $('#photo-status').textContent=`${matches.length} ${matches.length===1?'imagem semelhante encontrada':'imagens semelhantes encontradas'}.`;
      photoResults.innerHTML=`<div class="photo-result"><h4>Encontrei ${matches.length===1?'uma imagem semelhante':'imagens semelhantes'}. Pode ser a pessoa que você procura?</h4><p>Compare os retratos e confira idade, local e data. O resultado é uma semelhança visual para revisão.</p><div class="case-grid">${cards}</div><button type="button" class="quiet" data-intake>Não parece ser · solicitar cadastro</button></div>`;
    } else {
      $('#photo-status').textContent='Nenhuma imagem semelhante nesta busca.';
      photoResults.innerHTML='<div class="photo-result"><h4>Não encontrei imagem semelhante. Quer solicitar o cadastro?</h4><p>Você também pode tentar uma foto mais nítida ou voltar para a busca por características.</p><button type="button" data-intake>Solicitar cadastro de teste</button></div>';
    }
  } catch {
    if (version===photoVersion) $('#photo-status').textContent='Não foi possível comparar a foto agora. Tente abrir o site pelo servidor local e refazer a busca.';
  } finally {
    if (version===photoVersion) scanButton.disabled=false;
  }
}

function stopCamera() {
  cameraVersion++;
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream=undefined;
  cameraVideo.srcObject=null;
  $('#capture-photo').disabled=true;
}

async function openCamera() {
  stopCamera();
  const version=cameraVersion;
  photoDialog.showModal();
  $('#camera-status').textContent='Aguardando acesso à câmera…';
  if (!navigator.mediaDevices?.getUserMedia) {
    $('#camera-status').textContent='A câmera requer HTTPS ou localhost. Você pode fechar esta janela e escolher um arquivo.';
    return;
  }
  try {
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if (version!==cameraVersion) {stream.getTracks().forEach(track=>track.stop());return;}
    cameraStream=stream;
    cameraVideo.srcObject=stream;
    await cameraVideo.play();
    if (version!==cameraVersion) return;
    $('#camera-status').textContent='Posicione a foto na moldura e capture.';
    $('#capture-photo').disabled=false;
  } catch {
    if (version!==cameraVersion) return;
    stopCamera();
    $('#camera-status').textContent='Não foi possível acessar a câmera. Verifique a permissão do navegador ou escolha um arquivo.';
  }
}

function capturePhoto() {
  if (!cameraVideo.videoWidth) return;
  const video=cameraVideo.getBoundingClientRect();
  const frame=$('.camera-frame').getBoundingClientRect();
  const scale=Math.min(video.width/cameraVideo.videoWidth,video.height/cameraVideo.videoHeight);
  const width=cameraVideo.videoWidth*scale;
  const height=cameraVideo.videoHeight*scale;
  const left=video.left+(video.width-width)/2;
  const top=video.top+(video.height-height)/2;
  const x=Math.max(0,(frame.left-left)/scale);
  const y=Math.max(0,(frame.top-top)/scale);
  const cropWidth=Math.min(cameraVideo.videoWidth-x,(Math.min(frame.right,left+width)-Math.max(frame.left,left))/scale);
  const cropHeight=Math.min(cameraVideo.videoHeight-y,(Math.min(frame.bottom,top+height)-Math.max(frame.top,top))/scale);
  if (cropWidth<64 || cropHeight<64) {
    $('#camera-status').textContent='A imagem da câmera está pequena. Aproxime a foto ou escolha um arquivo.';
    return;
  }
  const canvas=document.createElement('canvas');
  const outputScale=Math.min(1,960/Math.max(cropWidth,cropHeight));
  canvas.width=Math.round(cropWidth*outputScale);
  canvas.height=Math.round(cropHeight*outputScale);
  canvas.getContext('2d').drawImage(cameraVideo,x,y,cropWidth,cropHeight,0,0,canvas.width,canvas.height);
  photoDialog.close();
  selectPhoto(canvas.toDataURL('image/jpeg',.9));
}

$('#mode-description').addEventListener('click',()=>setMode(false));
$('#mode-photo').addEventListener('click',()=>setMode(true));
$('#sample-match').addEventListener('click',()=>selectPhoto(demo.fotoEpoca));
$('#sample-miss').addEventListener('click',()=>selectPhoto(sampleWithoutMatch()));
$('#clear-photo').addEventListener('click',clearPhoto);
$('#run-scan').addEventListener('click',scan);
$('#photo-file').addEventListener('change',event=>{
  const file=event.target.files[0];
  if (!file) return;
  if (file.size>12*1024*1024) {clearPhoto();$('#photo-status').textContent='Escolha uma imagem de até 12 MB.';return;}
  selectPhoto(URL.createObjectURL(file));
});
$('#open-camera').addEventListener('click',openCamera);
$('#close-camera').addEventListener('click',()=>photoDialog.close());
$('#capture-photo').addEventListener('click',capturePhoto);
photoDialog.addEventListener('close',stopCamera);
window.addEventListener('pagehide',stopCamera);
photoResults.addEventListener('click',event=>{
  const candidate=event.target.closest('button[data-match]');
  if (candidate) openCase(candidate.dataset.match,candidate,true);
  if (event.target.closest('button[data-intake]')) {
    $('#intake-form').reset();
    $('#intake-result').textContent='';
    $('#intake-dialog').showModal();
  }
});
$('#close-intake').addEventListener('click',()=>$('#intake-dialog').close());
$('#intake-form').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('#intake-name').value.trim();
  const age=Number($('#intake-age').value);
  const zone=$('#intake-zone').value;
  if (!name) {$('#intake-result').textContent='Informe um nome fictício.';return;}
  if (protocols.some(p=>p.kind==='cadastro' && normalize(p.name)===normalize(name) && p.age===age && p.zone===zone)) {
    $('#intake-result').textContent='Esta solicitação de teste já está na fila.';
    return;
  }
  const protocol=addProtocol({kind:'cadastro',name,age,zone});
  clearPhoto();
  $('#intake-result').textContent=`${protocol.id} criado e aguardando revisão na fila simulada.`;
});
