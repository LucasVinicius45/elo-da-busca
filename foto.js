'use strict';

// Compara a composição da foto. Não extrai vetores faciais ou identifica pessoas.
window.ReencontroFotos = (() => {
  const side = 16;
  const threshold = .865;
  let indexPromise;

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível abrir a imagem. Tente JPG ou PNG.'));
      image.src = source;
    });
  }

  function signature(image, trim, zoom) {
    const width = image.naturalWidth;
    const height = image.naturalHeight * (1-trim);
    const square = Math.min(width,height) * zoom;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    const context = canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(image,(width-square)/2,(height-square)/2,square,square,0,0,side,side);
    const pixels = context.getImageData(0,0,side,side).data;
    const values = new Float32Array(side*side);
    let total = 0;
    for (let i=0;i<values.length;i++) {
      const j=i*4;
      values[i]=.299*pixels[j]+.587*pixels[j+1]+.114*pixels[j+2];
      total+=values[i];
    }
    const mean=total/values.length;
    let energy=0;
    for (let i=0;i<values.length;i++) { values[i]-=mean; energy+=values[i]**2; }
    const norm=Math.sqrt(energy);
    if (norm<1) return null;
    for (let i=0;i<values.length;i++) values[i]/=norm;
    return values;
  }

  function views(image) {
    return [[0,1],[.08,1],[.08,.88],[0,.80],[0,.92],[.08,.76]].map(([trim,zoom]) => signature(image,trim,zoom)).filter(Boolean);
  }

  function compare(a,b) {
    let dot=0;
    for (let i=0;i<a.length;i++) dot+=a[i]*b[i];
    return dot;
  }

  async function makeIndex(cases) {
    const pictures=cases.flatMap(item => [item.fotoEpoca,item.foto2026].map(src => ({id:item.id,src})));
    const index=[];
    for (let start=0;start<pictures.length;start+=12) {
      const group=await Promise.all(pictures.slice(start,start+12).map(async item => ({...item,views:views(await loadImage(item.src))})));
      index.push(...group);
    }
    return index;
  }

  async function search(image,cases) {
    const input=views(image);
    if (!input.length) return [];
    if (!indexPromise) indexPromise=makeIndex(cases).catch(error => { indexPromise=null; throw error; });
    const best=new Map();
    for (const item of await indexPromise) {
      let score=-1;
      for (const a of input) for (const b of item.views) score=Math.max(score,compare(a,b));
      if (score>=threshold && score>(best.get(item.id)?.score ?? -1)) best.set(item.id,{id:item.id,src:item.src,score});
    }
    return [...best.values()].sort((a,b) => b.score-a.score).slice(0,3);
  }

  return {loadImage,search};
})();
