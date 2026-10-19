export const isPersonalScene=id=>typeof id==='string'&&/^photo-[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)
export function sceneImageSize(width,height){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>40000000)throw new Error('La fotografía admite hasta 40 megapíxeles.')
  const scale=Math.min(1,2560/Math.max(width,height))
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))}
}
export async function prepareScenePhoto(file){
  if(!file?.size||file.size>20*1024*1024)throw new Error('Elige una fotografía PNG, JPEG o WebP de hasta 20 MB.')
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer())
  const png=[137,80,78,71,13,10,26,10].every((byte,i)=>bytes[i]===byte),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  if(!png&&!jpeg&&!webp)throw new Error('Elige una fotografía PNG, JPEG o WebP de hasta 20 MB.')
  const url=URL.createObjectURL(file),image=new Image()
  try{
    image.src=url;await image.decode()
    const size=sceneImageSize(image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');Object.assign(canvas,size)
    const context=canvas.getContext('2d');context.fillStyle='#65503b';context.fillRect(0,0,size.width,size.height);context.drawImage(image,0,0,size.width,size.height)
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));if(!blob)throw new Error('No se pudo preparar la fotografía.')
    const thumb=document.createElement('canvas');thumb.width=256;thumb.height=Math.max(1,Math.round(256*size.height/size.width));if(thumb.height>256){thumb.height=256;thumb.width=Math.max(1,Math.round(256*size.width/size.height))}
    const small=thumb.getContext('2d');small.drawImage(canvas,0,0,thumb.width,thumb.height)
    const pixels=small.getImageData(0,0,thumb.width,thumb.height).data;let luminance=0
    for(let i=0;i<pixels.length;i+=4)luminance+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722
    const thumbnail=await new Promise(resolve=>thumb.toBlob(resolve,'image/webp',.8))
    return {image:blob,thumbnail:thumbnail??blob,bright:luminance/(pixels.length/4)>145,...size}
  }catch(error){if(error.message==='La fotografía admite hasta 40 megapíxeles.')throw error;throw new Error('No se pudo preparar la fotografía.')}finally{URL.revokeObjectURL(url)}
}
