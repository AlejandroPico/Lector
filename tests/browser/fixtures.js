import JSZip from 'jszip'

export const paragraph = 'El sosiego de la tarde acompañaba a Elena. La luz cruzaba el umbral y dibujaba líneas tenues sobre el suelo. Marcos dejó el libro junto a la ventana. «Mañana volveremos», dijo, y por primera vez en mucho tiempo no había prisa. '
export const longHTML = `<h1 id="inicio">El jardín en silencio</h1>${Array.from({ length: 32 }, (_, i) => `<p id="p${i}">${i + 1}. ${paragraph.repeat(2)}</p>`).join('')}`
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOu0AAAAASUVORK5CYII='

export async function epub() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
  zip.file('OPS/book.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">lector-test</dc:identifier><dc:title>El jardín en silencio</dc:title><dc:language>es</dc:language><dc:creator>Libro de prueba</dc:creator></metadata><manifest><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`)
  zip.file('OPS/nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Índice</title></head><body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">El jardín</a><ol><li><a href="chapter1.xhtml#p12">La ventana</a></li></ol></li><li><a href="chapter2.xhtml">El regreso</a></li></ol></nav></body></html>')
  zip.file('OPS/chapter1.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>El jardín</title></head><body>${longHTML}</body></html>`)
  zip.file('OPS/chapter2.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>El regreso</title></head><body><h1>El regreso</h1><p>La mañana había llegado. <a href="#nota" epub:type="noteref">1</a></p><img src="cover.png" alt="Ilustración de prueba"/><aside id="nota" epub:type="footnote">Una nota a pie de página del libro.</aside><script>parent.__bookExecuted = true</script><img src="https://example.com/tracker.png" onerror="parent.__bookExecuted = true"/></body></html>')
  zip.file('OPS/cover.png', image, { base64: true })
  return zip.generateAsync({ type: 'nodebuffer' })
}

export async function coverEPUB(title='El jardín en silencio') {
  const zip=await JSZip.loadAsync(await epub())
  let opf=await zip.file('OPS/book.opf').async('string')
  opf=opf.replace('<dc:title>El jardín en silencio</dc:title>',`<dc:title>${title}</dc:title>`)
    .replace('href="cover.png" media-type="image/png"','href="cover.svg" media-type="image/svg+xml"')
    .replace('<manifest>','<manifest><item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>')
    .replace('<spine>','<spine><itemref idref="cover-page"/>')
  zip.file('OPS/book.opf',opf)
  zip.file('OPS/cover.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cubierta</title></head><body><img src="cover.svg" width="80" height="120" alt="Cubierta"/></body></html>')
  zip.file('OPS/cover.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#324f46"/><rect x="32" y="32" width="536" height="836" fill="none" stroke="#bdbb91"/><path d="M300 690V520M300 600C230 570 230 510 300 545M300 640C370 610 370 540 300 590" fill="none" stroke="#a4b396" stroke-width="5"/><text x="300" y="255" text-anchor="middle" fill="#f3ebd4" font-family="Georgia" font-size="36">${title}</text><text x="300" y="780" text-anchor="middle" fill="#bdbb91" font-family="Georgia" font-size="22">Libro de prueba</text></svg>`)
  return zip.generateAsync({type:'nodebuffer'})
}

export async function docx() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Documento Word de prueba</w:t></w:r></w:p><w:p><w:r><w:t>El sosiego regresó al jardín. Este texto procede de un archivo Word.</w:t></w:r></w:p></w:body></w:document>')
  return zip.generateAsync({ type: 'nodebuffer' })
}

export function mobi() {
  const text = Buffer.from('<html><head><title>Libro MOBI</title></head><body><h1>Libro MOBI de prueba</h1><p>El sosiego llegó al jardín. Este texto procede de un archivo MOBI.</p></body></html>')
  const pdb = Buffer.alloc(96), header = Buffer.alloc(320), title = Buffer.from('Libro MOBI')
  pdb.write('Libro MOBI', 0); pdb.write('BOOKMOBI', 60); pdb.writeUInt16BE(2, 76)
  pdb.writeUInt32BE(96, 78); pdb.writeUInt32BE(416, 86)
  header.writeUInt16BE(1, 0); header.writeUInt32BE(text.length, 4); header.writeUInt16BE(1, 8); header.writeUInt16BE(4096, 10)
  header.write('MOBI', 16); header.writeUInt32BE(264, 20); header.writeUInt32BE(2, 24); header.writeUInt32BE(65001, 28)
  header.writeUInt32BE(123, 32); header.writeUInt32BE(6, 36); header.writeUInt32BE(280, 84); header.writeUInt32BE(title.length, 88)
  header.writeUInt8(10, 95); header.writeUInt32BE(2, 108); header.writeUInt32BE(0xffffffff, 244); title.copy(header, 280)
  return Buffer.concat([pdb, header, text])
}

export function pdf(scanned = false) {
  const stream = scanned ? '' : 'BT /F1 18 Tf 72 700 Td (Documento PDF de prueba.) Tj 0 -35 Td (Este texto se puede leer y escuchar.) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let output = '%PDF-1.4\n'; const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(output)
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(output)
}
