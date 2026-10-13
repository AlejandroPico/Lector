import {it,expect} from 'vitest'
import {citation,notebookEntries,notesMarkdown,notesHTML} from '../src/notes.js'
import {notesRows} from '../src/i18n-notes.js'
it('quotes include author, title and stable location; notebook filters across books',()=>{
  const book={id:'a',title:'Libro',author:'Autora',notes:[{id:'n',quote:'Un texto.',text:'Mi nota',kind:'note',reference:'Ubicación 2.3.4',createdAt:1}]}
  expect(citation(book,book.notes[0])).toBe('«Un texto.»\nAutora · Libro · Ubicación 2.3.4')
  expect(notebookEntries([book],{query:'texto',kind:'note'})).toHaveLength(1);expect(notebookEntries([book],{bookId:'b'})).toEqual([])
})
it('exports literal user text without executing or embedding HTML and preserves Unicode',()=>{
  const entries=[{book:{title:'<script>danger</script>',author:'作者'},note:{quote:'[quote](https://evil.test)\nनमस्ते',text:'<img onerror="bad">',reference:'2.3.4'}}]
  const html=notesHTML(entries);expect(html).not.toContain('<script>');expect(html).not.toContain('<img');expect(html).toContain('&lt;img');expect(html).toContain('नमस्ते')
  expect(notesMarkdown(entries)).toContain('> \\[quote\\](https://evil.test)\n> नमस्ते')
  for(const row of notesRows.trim().split('\n'))expect(row.split('|')).toHaveLength(10)
})
