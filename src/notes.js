export const annotationColors={gold:{label:'Dorado',color:'#b3872d'},green:{label:'Verde',color:'#3b8e68'},blue:{label:'Azul',color:'#438acc'},pink:{label:'Rosa',color:'#ca6997'},orange:{label:'Naranja',color:'#c97630'},red:{label:'Rojo',color:'#c24949'},coral:{label:'Coral',color:'#d06a59'},peach:{label:'Melocotón',color:'#ca9065'},amber:{label:'Ámbar',color:'#ad7819'},lemon:{label:'Limón',color:'#a49424'},olive:{label:'Oliva',color:'#758538'},mint:{label:'Menta',color:'#4b9f8c'},teal:{label:'Turquesa',color:'#288f98'},cyan:{label:'Cian',color:'#299bb8'},navy:{label:'Azul marino',color:'#476394'},indigo:{label:'Índigo',color:'#6554a8'},violet:{label:'Violeta',color:'#925eb1'},lavender:{label:'Lavanda',color:'#a083bc'},plum:{label:'Ciruela',color:'#954d88'},rosewood:{label:'Palo de rosa',color:'#a56876'},copper:{label:'Cobre',color:'#a96c47'},brown:{label:'Marrón',color:'#856448'},slate:{label:'Pizarra',color:'#6d8594'},gray:{label:'Gris',color:'#7d807e'}}
export const annotationColor=note=>annotationColors[note.color]?.color??annotationColors.gold.color
export function citation(book,note){return [note.quote?`«${note.quote}»`:note.label??'', [book.author,book.title,note.reference??note.label??note.cfi].filter(Boolean).join(' · ')].filter(Boolean).join('\n')}
export function notebookEntries(books,{query='',bookId='',kind=''}={}){
  const needle=query.toLocaleLowerCase()
  return books.filter(book=>!bookId||book.id===bookId).flatMap(book=>(book.notes??[]).filter(note=>!kind||note.kind===kind).map(note=>({book,note})))
    .filter(({book,note})=>[book.title,book.author,note.quote,note.text,note.label].join(' ').toLocaleLowerCase().includes(needle))
    .sort((a,b)=>(b.note.updatedAt??b.note.createdAt)-(a.note.updatedAt??a.note.createdAt))
}
const markdown=value=>String(value??'').replace(/[\\`*_{}[\]<>#]/g,'\\$&')
const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
export function notesMarkdown(entries,title='Notas y citas'){
  return `# ${markdown(title)}\n\n`+entries.map(({book,note})=>`## ${markdown(book.title)}\n\n${note.quote?note.quote.split('\n').map(line=>`> ${markdown(line)}`).join('\n')+'\n\n':''}${markdown(note.text)}\n\n${markdown([book.author,note.reference??note.label??note.cfi].filter(Boolean).join(' · '))}\n`).join('\n')
}
export function notesHTML(entries,title='Notas y citas'){
  return `<!doctype html><html><head><meta charset="utf-8"><title>${html(title)}</title><style>body{font:16px Georgia,serif;max-width:800px;margin:32px auto;padding:16px;color:#222}h1{font-size:24px}h2{font-size:18px}article{border-top:1px solid #bbb;padding:16px 0;break-inside:avoid}blockquote,p{white-space:pre-wrap;overflow-wrap:anywhere}small{font:12px sans-serif;color:#555}@media print{body{margin:0;max-width:none}@page{margin:20mm}}</style></head><body><h1>${html(title)}</h1>${entries.map(({book,note})=>`<article><h2>${html(book.title)}</h2>${note.quote?`<blockquote>${html(note.quote)}</blockquote>`:''}<p>${html(note.text)}</p><small>${html([book.author,note.reference??note.label??note.cfi].filter(Boolean).join(' · '))}</small></article>`).join('')}</body></html>`
}
