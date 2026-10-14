// Geometry is a reading-order heuristic, not a reconstruction of editorial layout.
export function pdfLines(items, height) {
  const rows=[]
  for(const item of items){
    if(!item.str?.trim())continue
    const size=Math.max(1,Math.hypot(item.transform[2],item.transform[3])||item.height||10)
    const box={text:item.str,x:item.transform[4],y:height-item.transform[5],width:Math.abs(item.width||0),size,dir:item.dir}
    let row=rows.find(row=>Math.abs(row.y-box.y)<Math.max(2,Math.min(row.size,size)*.35))
    if(!row){row={y:box.y,size,items:[]};rows.push(row)}
    row.items.push(box)
  }
  return rows.sort((a,b)=>a.y-b.y).flatMap(row=>{
    const sorted=row.items.sort((a,b)=>a.x-b.x),chunks=[];let chunk
    for(const box of sorted){
      const gap=chunk?box.x-chunk.right:Infinity
      if(!chunk||gap>Math.max(18,box.size*2.2)){chunk={x:box.x,right:box.x+box.width,y:row.y,size:box.size,text:box.text,dir:box.dir};chunks.push(chunk)}
      else {chunk.text+=(gap>box.size*.12&&!chunk.text.endsWith(' ')?' ':'')+box.text;chunk.right=Math.max(chunk.right,box.x+box.width)}
    }
    return chunks
  })
}
export const marginSignature=text=>text.toLowerCase().replace(/\d+/g,'#').replace(/\s+/g,' ').trim()
export function repeatedMargins(pages){
  const seen=new Map()
  for(const page of pages){const unique=new Set(page.lines.filter(line=>line.y<page.height*.09||line.y>page.height*.91).map(line=>marginSignature(line.text)));for(const key of unique)seen.set(key,(seen.get(key)||0)+1)}
  return new Set([...seen].filter(([,count])=>pages.length>1&&count>=Math.max(2,Math.ceil(pages.length*.6))).map(([key])=>key))
}
export function orderedPDFLines(page,{order='auto',hideMargins=false}={},repeated=new Set()){
  let lines=page.lines.filter(line=>!hideMargins||!((line.y<page.height*.09||line.y>page.height*.91)&&repeated.has(marginSignature(line.text))))
  if(order==='original')return (page.originalLines??lines).filter(line=>!hideMargins||!((line.y<page.height*.09||line.y>page.height*.91)&&repeated.has(marginSignature(line.text))))
  if(order==='1')return lines.sort((a,b)=>a.y-b.y||a.x-b.x)
  const left=Math.min(...lines.map(line=>line.x)),right=Math.max(...lines.map(line=>line.right))
  if(!lines.length)return []
  let cuts=[]
  if(order==='2'||order==='3')cuts=Array.from({length:Number(order)-1},(_,i)=>left+(right-left)*(i+1)/Number(order))
  else {
    // A gutter must leave several independent lines on both sides. Spanning
    // headings are allowed; densely crossing body text rules out a gutter.
    for(let x=left+(right-left)*.2;x<right-(right-left)*.2;x+=(right-left)/80||1){
      const a=lines.filter(line=>line.right<x-6),b=lines.filter(line=>line.x>x+6),cross=lines.filter(line=>line.x<x+6&&line.right>x-6)
      if(a.length>=3&&b.length>=3&&cross.length<=Math.max(1,lines.length*.12)){
        if(!cuts.length||x-cuts.at(-1)>(right-left)*.18)cuts.push(x)
      }
    }
    cuts=cuts.slice(0,2)
  }
  if(!cuts.length)return lines.sort((a,b)=>a.y-b.y||a.x-b.x)
  const spanning=lines.filter(line=>line.y<page.height*.09||line.y>page.height*.91||cuts.some(x=>line.x<x&&line.right>x)).sort((a,b)=>a.y-b.y)
  const rtl=lines.filter(line=>line.dir==='rtl').length>lines.length/2,result=[]
  const band=(start,end)=>{
    const columns=Array.from({length:cuts.length+1},()=>[])
    for(const line of lines)if(line.y>=start&&line.y<end&&!spanning.includes(line)){const column=cuts.filter(x=>line.x>=x).length;columns[column].push(line)}
    if(rtl)columns.reverse()
    result.push(...columns.flatMap(column=>column.sort((a,b)=>a.y-b.y||a.x-b.x)))
  }
  let start=-Infinity
  for(const heading of spanning){band(start,heading.y);result.push(heading);start=heading.y+.01}
  band(start,Infinity);return result
}
