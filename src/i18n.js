import { detailRows } from './i18n-details.js'
import { releaseRows } from './i18n-releases.js'
export const languages = { es: 'Español', ca: 'Català', en: 'English', fr: 'Français', de: 'Deutsch', pt: 'Português', it: 'Italiano', zh: '中文', ja: '日本語', hi: 'हिन्दी' }
const order = Object.keys(languages)
let active = 'es'
export function detectLanguage(preference = 'auto', browserLanguages = navigator.languages) {
  if (preference !== 'auto' && languages[preference]) return preference
  for (const language of browserLanguages ?? []) {
    const base = language.toLowerCase().split(/[-_]/)[0]
    if (languages[base]) return base
  }
  return 'en'
}
// Each line contains the same message in es, ca, en, fr, de, pt, it, zh, ja, hi.
const rows = `
Controles del lector|Controls del lector|Reader controls|Commandes de lecture|Lesesteuerung|Controlos de leitura|Controlli di lettura|阅读控制|読書コントロール|पठन नियंत्रण
Índice y biblioteca|Índex i biblioteca|Contents and library|Sommaire et bibliothèque|Inhalt und Bibliothek|Índice e biblioteca|Indice e biblioteca|目录和书库|目次とライブラリ|विषय सूची और पुस्तकालय
Abrir documento (Ctrl+O)|Obrir document (Ctrl+O)|Open document (Ctrl+O)|Ouvrir un document (Ctrl+O)|Dokument öffnen (Strg+O)|Abrir documento (Ctrl+O)|Apri documento (Ctrl+O)|打开文档 (Ctrl+O)|文書を開く (Ctrl+O)|दस्तावेज़ खोलें (Ctrl+O)
Leer en voz alta|Llegir en veu alta|Read aloud|Lire à voix haute|Vorlesen|Ler em voz alta|Leggi ad alta voce|朗读|読み上げ|ज़ोर से पढ़ें
Ajustes de voz|Ajustos de veu|Voice settings|Réglages de la voix|Stimmeinstellungen|Definições de voz|Impostazioni vocali|语音设置|音声設定|आवाज़ की सेटिंग
Tipografía y página|Tipografia i pàgina|Typography and page|Typographie et page|Schrift und Seite|Tipografia e página|Tipografia e pagina|字体与页面|書体とページ|फ़ॉन्ट और पृष्ठ
Tema|Tema|Theme|Thème|Design|Tema|Tema|主题|テーマ|थीम
Modo zen (Z)|Mode zen (Z)|Zen mode (Z)|Mode zen (Z)|Zen-Modus (Z)|Modo zen (Z)|Modalità zen (Z)|禅模式 (Z)|禅モード (Z)|ज़ेन मोड (Z)
Pantalla completa (F)|Pantalla completa (F)|Full screen (F)|Plein écran (F)|Vollbild (F)|Ecrã inteiro (F)|Schermo intero (F)|全屏 (F)|全画面 (F)|पूर्ण स्क्रीन (F)
Acerca de Lector|Quant a Lector|About Lector|À propos de Lector|Über Lector|Sobre o Lector|Informazioni su Lector|关于 Lector|Lectorについて|Lector के बारे में
Navegación del libro|Navegació del llibre|Book navigation|Navigation du livre|Buchnavigation|Navegação do livro|Navigazione del libro|书籍导航|本のナビゲーション|पुस्तक नेविगेशन
Biblioteca|Biblioteca|Library|Bibliothèque|Bibliothek|Biblioteca|Biblioteca|书库|ライブラリ|पुस्तकालय
Cerrar índice|Tancar índex|Close contents|Fermer le sommaire|Inhalt schließen|Fechar índice|Chiudi indice|关闭目录|目次を閉じる|विषय सूची बंद करें
Navegación|Navegació|Navigation|Navigation|Navigation|Navegação|Navigazione|导航|ナビゲーション|नेविगेशन
Índice|Índex|Contents|Sommaire|Inhalt|Índice|Indice|目录|目次|विषय सूची
Notas|Notes|Notes|Notes|Notizen|Notas|Note|笔记|ノート|नोट्स
Libros|Llibres|Books|Livres|Bücher|Livros|Libri|书籍|本|पुस्तकें
Ver portada|Veure coberta|View cover|Voir la couverture|Cover ansehen|Ver capa|Vedi copertina|查看封面|表紙を見る|आवरण देखें
Buscar en el libro|Cercar al llibre|Search the book|Chercher dans le livre|Im Buch suchen|Pesquisar no livro|Cerca nel libro|搜索书籍|本の中を検索|पुस्तक में खोजें
Buscar|Cercar|Search|Chercher|Suchen|Pesquisar|Cerca|搜索|検索|खोजें
Capítulos|Capítols|Chapters|Chapitres|Kapitel|Capítulos|Capitoli|章节|章|अध्याय
Abre un libro para ver su índice.|Obre un llibre per veure'n l'índex.|Open a book to see its contents.|Ouvrez un livre pour voir son sommaire.|Öffne ein Buch, um den Inhalt zu sehen.|Abra um livro para ver o índice.|Apri un libro per vedere l'indice.|打开书籍查看目录。|本を開くと目次が表示されます。|विषय सूची देखने के लिए पुस्तक खोलें।
Marcar página|Marcar pàgina|Bookmark page|Marquer la page|Lesezeichen setzen|Marcar página|Aggiungi segnalibro|添加书签|しおりを付ける|पृष्ठ चिह्नित करें
Exportar notas|Exportar notes|Export notes|Exporter les notes|Notizen exportieren|Exportar notas|Esporta note|导出笔记|ノートを出力|नोट्स निर्यात करें
Libro|Llibre|Book|Livre|Buch|Livro|Libro|书籍|本|पुस्तक
Página anterior (←)|Pàgina anterior (←)|Previous page (←)|Page précédente (←)|Vorherige Seite (←)|Página anterior (←)|Pagina precedente (←)|上一页 (←)|前のページ (←)|पिछला पृष्ठ (←)
Página siguiente (→)|Pàgina següent (→)|Next page (→)|Page suivante (→)|Nächste Seite (→)|Página seguinte (→)|Pagina successiva (→)|下一页 (→)|次のページ (→)|अगला पृष्ठ (→)
Ir a una posición del libro|Anar a una posició del llibre|Go to a book position|Aller à une position du livre|Zu einer Buchposition gehen|Ir para uma posição do livro|Vai a una posizione del libro|跳转到书籍位置|本の位置に移動|पुस्तक की स्थिति पर जाएँ
Salir del modo zen|Sortir del mode zen|Exit zen mode|Quitter le mode zen|Zen-Modus verlassen|Sair do modo zen|Esci dalla modalità zen|退出禅模式|禅モードを終了|ज़ेन मोड से बाहर निकलें
Cerrar|Tancar|Close|Fermer|Schließen|Fechar|Chiudi|关闭|閉じる|बंद करें
Tipografía|Tipografia|Typeface|Police|Schriftart|Tipo de letra|Carattere|字体|書体|फ़ॉन्ट
Tamaño|Mida|Size|Taille|Größe|Tamanho|Dimensione|大小|サイズ|आकार
Interlineado|Interlineat|Line spacing|Interligne|Zeilenabstand|Entrelinha|Interlinea|行距|行間|पंक्ति अंतर
Espacio entre párrafos|Espai entre paràgrafs|Paragraph spacing|Espacement des paragraphes|Absatzabstand|Espaço entre parágrafos|Spaziatura dei paragrafi|段落间距|段落間隔|अनुच्छेद अंतर
Columnas|Columnes|Columns|Colonnes|Spalten|Colunas|Colonne|栏数|段組み|स्तंभ
Una|Una|One|Une|Eine|Uma|Una|一栏|1段|एक
Dos|Dues|Two|Deux|Zwei|Duas|Due|两栏|2段|दो
Tres|Tres|Three|Trois|Drei|Três|Tre|三栏|3段|तीन
Anchura de lectura|Amplada de lectura|Reading width|Largeur de lecture|Lesebreite|Largura de leitura|Larghezza di lettura|阅读宽度|読書幅|पठन चौड़ाई
Separación de columnas|Separació de columnes|Column spacing|Espacement des colonnes|Spaltenabstand|Espaço entre colunas|Spaziatura delle colonne|栏间距|段の間隔|स्तंभ अंतर
Justificar el texto|Justificar el text|Justify text|Justifier le texte|Blocksatz|Justificar o texto|Giustifica il testo|两端对齐|両端揃え|पाठ को दोनों ओर संरेखित करें
Transición suave de página|Transició suau de pàgina|Smooth page transition|Transition douce des pages|Sanfter Seitenwechsel|Transição suave de página|Transizione fluida delle pagine|平滑翻页|滑らかなページ切り替え|सहज पृष्ठ परिवर्तन
Restablecer presentación|Restablir presentació|Reset presentation|Réinitialiser la présentation|Darstellung zurücksetzen|Repor apresentação|Ripristina presentazione|重置显示|表示をリセット|प्रस्तुति रीसेट करें
Automático|Automàtic|Automatic|Automatique|Automatisch|Automático|Automatico|自动|自動|स्वचालित
Mañana|Matí|Morning|Matin|Morgen|Manhã|Mattino|早晨|朝|सुबह
Tarde|Tarda|Afternoon|Après-midi|Nachmittag|Tarde|Pomeriggio|午后|午後|दोपहर
Noche|Nit|Night|Nuit|Nacht|Noite|Notte|夜晚|夜|रात
Confort|Confort|Comfort|Confort|Komfort|Conforto|Comfort|舒适|コンフォート|आराम
Natural|Natural|Natural|Nature|Natur|Natural|Naturale|自然|ナチュラル|प्राकृतिक
Contraste|Contrast|Contrast|Contraste|Kontrast|Contraste|Contrasto|对比|コントラスト|कंट्रास्ट
Primavera|Primavera|Spring|Printemps|Frühling|Primavera|Primavera|春天|春|वसंत
Verano|Estiu|Summer|Été|Sommer|Verão|Estate|夏天|夏|ग्रीष्म
Otoño|Tardor|Autumn|Automne|Herbst|Outono|Autunno|秋天|秋|पतझड़
Invierno|Hivern|Winter|Hiver|Winter|Inverno|Inverno|冬天|冬|सर्दी
Lluvia|Pluja|Rain|Pluie|Regen|Chuva|Pioggia|雨天|雨|बारिश
Lectura en voz alta|Lectura en veu alta|Reading aloud|Lecture à voix haute|Vorlesen|Leitura em voz alta|Lettura ad alta voce|朗读|読み上げ|सस्वर पठन
Servicio|Servei|Service|Service|Dienst|Serviço|Servizio|服务|サービス|सेवा
Voces del navegador|Veus del navegador|Browser voices|Voix du navigateur|Browserstimmen|Vozes do navegador|Voci del browser|浏览器语音|ブラウザーの音声|ब्राउज़र की आवाज़ें
OpenAI / API compatible|OpenAI / API compatible|OpenAI / compatible API|OpenAI / API compatible|OpenAI / kompatible API|OpenAI / API compatível|OpenAI / API compatibile|OpenAI / 兼容 API|OpenAI / 互換API|OpenAI / संगत API
Voz|Veu|Voice|Voix|Stimme|Voz|Voce|语音|音声|आवाज़
Automática · idioma del libro|Automàtica · idioma del llibre|Automatic · book language|Automatique · langue du livre|Automatisch · Buchsprache|Automática · idioma do livro|Automatica · lingua del libro|自动 · 书籍语言|自動 · 本の言語|स्वचालित · पुस्तक की भाषा
Tono|To|Pitch|Hauteur|Tonhöhe|Tom|Tono|音调|声の高さ|स्वर
Dirección del servicio|Adreça del servei|Service address|Adresse du service|Dienstadresse|Endereço do serviço|Indirizzo del servizio|服务地址|サービスURL|सेवा का पता
Clave de API|Clau d'API|API key|Clé API|API-Schlüssel|Chave de API|Chiave API|API 密钥|APIキー|API कुंजी
Se conserva solo durante esta sesión|Es conserva només durant aquesta sessió|Kept only during this session|Conservée uniquement pendant cette session|Nur für diese Sitzung gespeichert|Mantida apenas nesta sessão|Conservata solo per questa sessione|仅在本次会话中保留|このセッション中のみ保持|केवल इस सत्र में रखी जाती है
Modelo|Model|Model|Modèle|Modell|Modelo|Modello|模型|モデル|मॉडल
Indicaciones de narración|Indicacions de narració|Narration instructions|Consignes de narration|Erzählanweisungen|Instruções de narração|Istruzioni di narrazione|旁白指令|読み上げの指示|वाचन निर्देश
Velocidad|Velocitat|Speed|Vitesse|Geschwindigkeit|Velocidade|Velocità|速度|速度|गति
Resaltar el texto narrado|Ressaltar el text narrat|Highlight narrated text|Surligner le texte lu|Vorgelesenen Text hervorheben|Realçar o texto narrado|Evidenzia il testo letto|高亮朗读文本|読み上げ中のテキストを強調|पढ़े जा रहे पाठ को हाइलाइट करें
Probar voz|Provar veu|Try voice|Tester la voix|Stimme testen|Testar voz|Prova voce|测试语音|音声を試す|आवाज़ आज़माएँ
Detener|Aturar|Stop|Arrêter|Stoppen|Parar|Interrompi|停止|停止|रोकें
Texto seleccionado|Text seleccionat|Selected text|Texte sélectionné|Ausgewählter Text|Texto selecionado|Testo selezionato|选中文本|選択したテキスト|चयनित पाठ
Consultar|Consultar|Look up|Consulter|Nachschlagen|Consultar|Consulta|查询|調べる|अर्थ देखें
Anotar|Anotar|Annotate|Annoter|Notieren|Anotar|Annota|添加笔记|注釈|नोट जोड़ें
Leer desde aquí|Llegir des d'aquí|Read from here|Lire à partir d'ici|Ab hier vorlesen|Ler a partir daqui|Leggi da qui|从这里朗读|ここから読み上げ|यहाँ से पढ़ें
Abrir documento|Obrir document|Open document|Ouvrir un document|Dokument öffnen|Abrir documento|Apri documento|打开文档|文書を開く|दस्तावेज़ खोलें
Cerrar selector|Tancar selector|Close picker|Fermer le sélecteur|Auswahl schließen|Fechar seletor|Chiudi selettore|关闭选择器|選択画面を閉じる|चयनकर्ता बंद करें
Abrir un libro|Obrir un llibre|Open a book|Ouvrir un livre|Buch öffnen|Abrir um livro|Apri un libro|打开书籍|本を開く|पुस्तक खोलें
Guardar el archivo en este navegador|Desar el fitxer en aquest navegador|Save the file in this browser|Enregistrer le fichier dans ce navigateur|Datei in diesem Browser speichern|Guardar o ficheiro neste navegador|Salva il file in questo browser|在浏览器中保存文件|このブラウザーにファイルを保存|इस ब्राउज़र में फ़ाइल सहेजें
Nota de lectura|Nota de lectura|Reading note|Note de lecture|Lesenotiz|Nota de leitura|Nota di lettura|阅读笔记|読書ノート|पठन नोट
Tu nota|La teva nota|Your note|Votre note|Deine Notiz|A sua nota|La tua nota|你的笔记|あなたのノート|आपका नोट
Escribe una nota…|Escriu una nota…|Write a note…|Écrivez une note…|Schreibe eine Notiz…|Escreva uma nota…|Scrivi una nota…|写下笔记…|ノートを書く…|नोट लिखें…
Guardar nota|Desar nota|Save note|Enregistrer la note|Notiz speichern|Guardar nota|Salva nota|保存笔记|ノートを保存|नोट सहेजें
Consultar en Wikcionario ↗|Consultar al Viccionari ↗|Look up in Wiktionary ↗|Consulter le Wiktionnaire ↗|Im Wiktionary nachschlagen ↗|Consultar no Wikcionário ↗|Consulta Wikizionario ↗|在维基词典查询 ↗|ウィクショナリーで調べる ↗|विक्षनरी में देखें ↗
Importar diccionario propio|Importar diccionari propi|Import your dictionary|Importer un dictionnaire|Eigenes Wörterbuch importieren|Importar dicionário próprio|Importa dizionario personale|导入个人词典|辞書をインポート|अपना शब्दकोश आयात करें
Imagen ampliada|Imatge ampliada|Enlarged image|Image agrandie|Vergrößertes Bild|Imagem ampliada|Immagine ingrandita|放大的图片|拡大画像|बड़ी छवि
Reducir imagen|Reduir imatge|Zoom out|Réduire l'image|Verkleinern|Reduzir imagem|Riduci immagine|缩小图片|縮小|छवि छोटी करें
Ampliar imagen|Ampliar imatge|Zoom in|Agrandir l'image|Vergrößern|Ampliar imagem|Ingrandisci immagine|放大图片|拡大|छवि बड़ी करें
Ajustar imagen|Ajustar imatge|Fit image|Ajuster l'image|Bild einpassen|Ajustar imagem|Adatta immagine|适应窗口|画像を合わせる|छवि फ़िट करें
Cerrar imagen|Tancar imatge|Close image|Fermer l'image|Bild schließen|Fechar imagem|Chiudi immagine|关闭图片|画像を閉じる|छवि बंद करें
Nota del libro|Nota del llibre|Book footnote|Note du livre|Buchfußnote|Nota do livro|Nota del libro|书籍脚注|本の脚注|पुस्तक का फुटनोट
Leer a tu ritmo|Llegir al teu ritme|Read at your own pace|Lire à votre rythme|Lies in deinem Tempo|Ler ao seu ritmo|Leggi al tuo ritmo|按自己的节奏阅读|自分のペースで読む|अपनी गति से पढ़ें
Cerrar Acerca de|Tancar Quant a|Close About|Fermer À propos|Über schließen|Fechar Sobre|Chiudi Informazioni|关闭关于|この画面を閉じる|परिचय बंद करें
Ficha del proyecto|Fitxa del projecte|Project details|Fiche du projet|Projektdetails|Ficha do projeto|Scheda del progetto|项目详情|プロジェクト情報|परियोजना विवरण
Autor|Autor|Author|Auteur|Autor|Autor|Autore|作者|作者|लेखक
Carácter|Caràcter|Type|Nature|Art|Caráter|Natura|性质|種別|प्रकृति
Proyecto personal|Projecte personal|Personal project|Projet personnel|Persönliches Projekt|Projeto pessoal|Progetto personale|个人项目|個人プロジェクト|व्यक्तिगत परियोजना
Propósito|Propòsit|Purpose|Objectif|Zweck|Objetivo|Scopo|目的|目的|उद्देश्य
Lectura y escucha|Lectura i escolta|Reading and listening|Lecture et écoute|Lesen und Hören|Leitura e escuta|Lettura e ascolto|阅读与聆听|読む・聴く|पढ़ना और सुनना
Edición|Edició|Edition|Édition|Ausgabe|Edição|Edizione|版本|版|संस्करण
Principios del lector|Principis del lector|Reader principles|Principes du lecteur|Grundsätze des Readers|Princípios do leitor|Principi del lettore|阅读器原则|リーダーの理念|पाठक के सिद्धांत
Leer|Llegir|Read|Lire|Lesen|Ler|Leggere|阅读|読む|पढ़ें
Escuchar|Escoltar|Listen|Écouter|Hören|Ouvir|Ascoltare|聆听|聴く|सुनें
Recordar|Recordar|Remember|Retenir|Merken|Recordar|Ricordare|记住|覚える|याद रखें
Tu biblioteca.|La teva biblioteca.|Your library.|Votre bibliothèque.|Deine Bibliothek.|A sua biblioteca.|La tua biblioteca.|你的书库。|あなたのライブラリ。|आपका पुस्तकालय।
Atajos de lectura|Dreceres de lectura|Reading shortcuts|Raccourcis de lecture|Lesetastenkürzel|Atalhos de leitura|Scorciatoie di lettura|阅读快捷键|読書ショートカット|पठन शॉर्टकट
Enlaces del proyecto|Enllaços del projecte|Project links|Liens du projet|Projektlinks|Ligações do projeto|Link del progetto|项目链接|プロジェクトリンク|परियोजना के लिंक
01 · Autor|01 · Autor|01 · Author|01 · Auteur|01 · Autor|01 · Autor|01 · Autore|01 · 作者|01 · 作者|01 · लेखक
02 · Proyecto|02 · Projecte|02 · Project|02 · Projet|02 · Projekt|02 · Projeto|02 · Progetto|02 · 项目|02 · プロジェクト|02 · परियोजना
Portfolio de Alejandro Pico|Portfolio d'Alejandro Pico|Alejandro Pico's portfolio|Portfolio d'Alejandro Pico|Portfolio von Alejandro Pico|Portfolio de Alejandro Pico|Portfolio di Alejandro Pico|Alejandro Pico 的作品集|Alejandro Picoのポートフォリオ|Alejandro Pico का पोर्टफोलियो
Código y documentación|Codi i documentació|Code and documentation|Code et documentation|Code und Dokumentation|Código e documentação|Codice e documentazione|代码和文档|コードとドキュメント|कोड और दस्तावेज़
Posición del libro|Posició del llibre|Book position|Position du livre|Buchposition|Posição do livro|Posizione del libro|书籍位置|本の位置|पुस्तक की स्थिति
Porcentaje de lectura|Percentatge de lectura|Reading percentage|Pourcentage de lecture|Lesefortschritt|Percentagem de leitura|Percentuale di lettura|阅读百分比|読書の進捗|पठन प्रतिशत
Ir|Anar|Go|Aller|Los|Ir|Vai|跳转|移動|जाएँ
Abriendo libro…|Obrint llibre…|Opening book…|Ouverture du livre…|Buch wird geöffnet…|A abrir livro…|Apertura del libro…|正在打开书籍…|本を開いています…|पुस्तक खोली जा रही है…
Pausar lectura|Pausar lectura|Pause reading|Mettre en pause|Vorlesen pausieren|Pausar leitura|Pausa lettura|暂停朗读|読み上げを一時停止|पठन रोकें
Continuar lectura|Continuar lectura|Resume reading|Reprendre la lecture|Vorlesen fortsetzen|Continuar leitura|Riprendi lettura|继续朗读|読み上げを再開|पठन जारी रखें
Generando audio…|Generant àudio…|Generating audio…|Génération de l'audio…|Audio wird erzeugt…|A gerar áudio…|Generazione audio…|正在生成音频…|音声を生成中…|ऑडियो बनाया जा रहा है…
Sin título|Sense títol|Untitled|Sans titre|Ohne Titel|Sem título|Senza titolo|无标题|無題|शीर्षकहीन
Los libros que abras aparecerán aquí.|Els llibres que obris apareixeran aquí.|Books you open will appear here.|Les livres ouverts apparaîtront ici.|Geöffnete Bücher erscheinen hier.|Os livros abertos aparecerão aqui.|I libri aperti appariranno qui.|打开的书籍将显示在这里。|開いた本はここに表示されます。|आपकी खोली हुई पुस्तकें यहाँ दिखेंगी।
Quitar de la biblioteca|Treure de la biblioteca|Remove from library|Retirer de la bibliothèque|Aus Bibliothek entfernen|Remover da biblioteca|Rimuovi dalla biblioteca|从书库移除|ライブラリから削除|पुस्तकालय से हटाएँ
Eliminar nota|Eliminar nota|Delete note|Supprimer la note|Notiz löschen|Eliminar nota|Elimina nota|删除笔记|ノートを削除|नोट हटाएँ
Nota guardada|Nota desada|Note saved|Note enregistrée|Notiz gespeichert|Nota guardada|Nota salvata|笔记已保存|ノートを保存しました|नोट सहेजा गया
Página marcada|Pàgina marcada|Page bookmarked|Page marquée|Lesezeichen gesetzt|Página marcada|Pagina segnata|书签已添加|しおりを付けました|पृष्ठ चिह्नित किया गया
Buscando…|Cercant…|Searching…|Recherche…|Suche…|A pesquisar…|Ricerca…|正在搜索…|検索中…|खोज जारी है…
No se encontraron coincidencias.|No s'han trobat coincidències.|No matches found.|Aucun résultat.|Keine Treffer gefunden.|Nenhum resultado encontrado.|Nessun risultato trovato.|未找到匹配项。|一致する結果がありません。|कोई मेल नहीं मिला।
Ajustes|Ajustos|Settings|Réglages|Einstellungen|Definições|Impostazioni|设置|設定|सेटिंग
Idioma de la interfaz|Idioma de la interfície|Interface language|Langue de l'interface|Sprache der Oberfläche|Idioma da interface|Lingua dell'interfaccia|界面语言|表示言語|इंटरफ़ेस भाषा
Detectar idioma del sistema|Detectar l'idioma del sistema|Detect system language|Détecter la langue du système|Systemsprache erkennen|Detetar idioma do sistema|Rileva lingua del sistema|检测系统语言|システム言語を検出|सिस्टम की भाषा पहचानें
Apariencia|Aparença|Appearance|Apparence|Darstellung|Aparência|Aspetto|外观|表示スタイル|दिखावट
Lectura minimalista|Lectura minimalista|Minimal reading|Lecture minimaliste|Minimalistische Leseansicht|Leitura minimalista|Lettura minimalista|极简阅读|ミニマル読書|न्यूनतम पठन
El idioma cambia los menús, no el texto del libro.|L'idioma canvia els menús, no el text del llibre.|Language changes the menus, not the book text.|La langue change les menus, pas le texte du livre.|Die Sprache ändert die Menüs, nicht den Buchtext.|O idioma altera os menus, não o texto do livro.|La lingua cambia i menu, non il testo del libro.|语言设置更改菜单，不改变书籍内容。|言語設定はメニューだけに適用され、本の文章は変わりません。|भाषा मेनू बदलती है, पुस्तक का पाठ नहीं।
Las próximas apariencias se elegirán aquí.|Les properes aparences es triaran aquí.|Future appearances will be selected here.|Les prochaines apparences se choisiront ici.|Künftige Darstellungen werden hier ausgewählt.|As próximas aparências serão escolhidas aqui.|I prossimi aspetti si sceglieranno qui.|未来的外观可在此选择。|今後の表示スタイルはここで選択できます。|भविष्य की दिखावट यहाँ चुनी जाएगी।
Sans del sistema|Sans del sistema|System sans-serif|Sans-serif système|System-Sans-Serif|Sans do sistema|Sans di sistema|系统无衬线|システムのサンセリフ|सिस्टम सैन्स
Las fuentes no instaladas usan una alternativa similar. Atkinson y Lexend están incluidas.|Les fonts no instal·lades fan servir una alternativa similar. Atkinson i Lexend estan incloses.|Unavailable fonts use a similar fallback. Atkinson and Lexend are included.|Les polices absentes utilisent une alternative similaire. Atkinson et Lexend sont incluses.|Fehlende Schriften nutzen einen ähnlichen Ersatz. Atkinson und Lexend sind enthalten.|Fontes não instaladas usam uma alternativa semelhante. Atkinson e Lexend estão incluídas.|I caratteri non installati usano un'alternativa simile. Atkinson e Lexend sono inclusi.|未安装的字体使用类似替代字体。内置 Atkinson 和 Lexend。|未インストールの書体は似た書体で代替します。AtkinsonとLexendは同梱されています。|अनुपलब्ध फ़ॉन्ट समान विकल्प उपयोग करते हैं। Atkinson और Lexend शामिल हैं।
Usar toda la anchura disponible|Fer servir tota l'amplada disponible|Use the full available width|Utiliser toute la largeur disponible|Gesamte verfügbare Breite nutzen|Usar toda a largura disponível|Usa tutta la larghezza disponibile|使用全部可用宽度|利用できる幅をすべて使う|पूरी उपलब्ध चौड़ाई का उपयोग करें
Aquí puedes volver a la apariencia anterior. También puedes pulsar Esc.|Aquí pots tornar a l'aparença anterior. També pots prémer Esc.|Return to the previous appearance here. You can also press Esc.|Revenez à l'apparence précédente ici. Vous pouvez aussi appuyer sur Échap.|Hier kehrst du zur vorherigen Ansicht zurück. Du kannst auch Esc drücken.|Aqui pode voltar à aparência anterior. Também pode premir Esc.|Qui puoi tornare all'aspetto precedente. Puoi anche premere Esc.|点击这里返回之前的界面，也可按 Esc。|ここで元の表示に戻れます。Escキーでも戻れます。|यहाँ पिछली दिखावट पर लौटें। आप Esc भी दबा सकते हैं।
Entendido|Entesos|Got it|Compris|Verstanden|Entendido|Capito|知道了|わかりました|समझ गया
Añadir carpeta|Afegir carpeta|Add folder|Ajouter un dossier|Ordner hinzufügen|Adicionar pasta|Aggiungi cartella|添加文件夹|フォルダーを追加|फ़ोल्डर जोड़ें
Actualizar carpetas|Actualitzar carpetes|Refresh folders|Actualiser les dossiers|Ordner aktualisieren|Atualizar pastas|Aggiorna cartelle|刷新文件夹|フォルダーを更新|फ़ोल्डर रीफ़्रेश करें
Carpetas|Carpetes|Folders|Dossiers|Ordner|Pastas|Cartelle|文件夹|フォルダー|फ़ोल्डर
Título|Títol|Title|Titre|Titel|Título|Titolo|书名|タイトル|शीर्षक
Portadas|Cobertes|Covers|Couvertures|Cover|Capas|Copertine|封面|表紙|आवरण
Recientes|Recents|Recent|Récents|Zuletzt gelesen|Recentes|Recenti|最近阅读|最近の本|हाल की पुस्तकें
Buscar título o autor|Cercar títol o autor|Search title or author|Chercher un titre ou un auteur|Titel oder Autor suchen|Pesquisar título ou autor|Cerca titolo o autore|搜索书名或作者|タイトル・作者を検索|शीर्षक या लेखक खोजें
Ordenar por|Ordenar per|Sort by|Trier par|Sortieren nach|Ordenar por|Ordina per|排序方式|並べ替え|क्रमबद्ध करें
Cargar portada|Carregar coberta|Load cover|Charger la couverture|Cover laden|Carregar capa|Carica copertina|加载封面|表紙を読み込む|आवरण लोड करें
Leer metadatos|Llegir metadades|Read metadata|Lire les métadonnées|Metadaten lesen|Ler metadados|Leggi metadati|读取元数据|メタデータを読む|मेटाडेटा पढ़ें
Cancelar escaneo|Cancel·lar escaneig|Cancel scan|Annuler l'analyse|Scan abbrechen|Cancelar análise|Annulla scansione|取消扫描|スキャンを中止|स्कैन रद्द करें
Indexando carpetas…|Indexant carpetes…|Indexing folders…|Indexation des dossiers…|Ordner werden erfasst…|A indexar pastas…|Indicizzazione cartelle…|正在索引文件夹…|フォルダーを索引中…|फ़ोल्डर अनुक्रमित किए जा रहे हैं…
No hay resultados.|No hi ha resultats.|No results.|Aucun résultat.|Keine Ergebnisse.|Sem resultados.|Nessun risultato.|没有结果。|結果がありません。|कोई परिणाम नहीं।
Los títulos se obtienen de los nombres de carpeta. EPUB, metadatos y portadas se leen solo cuando los eliges.|Els títols s'obtenen dels noms de carpeta. EPUB, metadades i cobertes es llegeixen només quan els tries.|Titles come from folder names. EPUB files, metadata and covers are read only when you choose them.|Les titres viennent des noms de dossiers. EPUB, métadonnées et couvertures sont lus uniquement à votre demande.|Titel stammen aus Ordnernamen. EPUB, Metadaten und Cover werden erst auf Auswahl gelesen.|Os títulos vêm dos nomes das pastas. EPUB, metadados e capas só são lidos quando os escolhe.|I titoli provengono dai nomi delle cartelle. EPUB, metadati e copertine vengono letti solo su richiesta.|书名来自文件夹名称。仅在选择时读取 EPUB、元数据和封面。|タイトルはフォルダー名から取得します。EPUB・メタデータ・表紙は選択時だけ読み込みます。|शीर्षक फ़ोल्डर नामों से लिए जाते हैं। EPUB, मेटाडेटा और आवरण आपके चुनने पर ही पढ़े जाते हैं।
Para abrir carpetas sin leer todos sus archivos utiliza Chrome o Edge en HTTPS o localhost.|Per obrir carpetes sense llegir tots els fitxers, fes servir Chrome o Edge amb HTTPS o localhost.|For folder access without reading every file, use Chrome or Edge over HTTPS or localhost.|Pour accéder aux dossiers sans lire tous les fichiers, utilisez Chrome ou Edge sur HTTPS ou localhost.|Nutze Chrome oder Edge über HTTPS oder localhost, um Ordner ohne vollständiges Einlesen zu öffnen.|Para abrir pastas sem ler todos os ficheiros, use Chrome ou Edge em HTTPS ou localhost.|Per accedere alle cartelle senza leggere tutti i file usa Chrome o Edge su HTTPS o localhost.|使用 HTTPS 或 localhost 上的 Chrome 或 Edge，避免读取所有文件。|全ファイルを読み込まずにフォルダーへアクセスするには、HTTPSまたはlocalhostでChromeかEdgeを使用してください。|सभी फ़ाइलें पढ़े बिना फ़ोल्डर खोलने के लिए HTTPS या localhost पर Chrome या Edge उपयोग करें।
La carpeta requiere permiso de lectura. Vuelve a seleccionarla.|La carpeta requereix permís de lectura. Torna-la a seleccionar.|The folder needs read permission. Select it again.|Le dossier nécessite une autorisation de lecture. Sélectionnez-le à nouveau.|Der Ordner benötigt Leseberechtigung. Wähle ihn erneut aus.|A pasta precisa de permissão de leitura. Selecione-a novamente.|La cartella richiede il permesso di lettura. Selezionala di nuovo.|文件夹需要读取权限，请重新选择。|フォルダーの読み取り権限が必要です。再選択してください。|फ़ोल्डर को पढ़ने की अनुमति चाहिए। उसे फिर से चुनें।
El escaneo no lee el contenido de los archivos. OneDrive gestiona la descarga al abrirlos.|L'escaneig no llegeix el contingut dels fitxers. OneDrive gestiona la baixada en obrir-los.|Scanning does not read file contents. OneDrive handles downloads when files are opened.|L'analyse ne lit pas le contenu des fichiers. OneDrive gère le téléchargement à l'ouverture.|Beim Scan werden keine Dateiinhalte gelesen. OneDrive verwaltet Downloads beim Öffnen.|A análise não lê o conteúdo dos ficheiros. O OneDrive gere a transferência ao abri-los.|La scansione non legge il contenuto dei file. OneDrive gestisce il download all'apertura.|扫描不读取文件内容。OneDrive 在打开文件时处理下载。|スキャンはファイル内容を読みません。開いた際のダウンロードはOneDriveが管理します。|स्कैन फ़ाइल की सामग्री नहीं पढ़ता। खोलने पर OneDrive डाउनलोड संभालता है।
Selecciona un formato|Selecciona un format|Choose a format|Choisir un format|Format auswählen|Selecionar formato|Scegli formato|选择格式|形式を選択|प्रारूप चुनें
No se pudo leer la carpeta.|No s'ha pogut llegir la carpeta.|The folder could not be read.|Impossible de lire le dossier.|Der Ordner konnte nicht gelesen werden.|Não foi possível ler a pasta.|Impossibile leggere la cartella.|无法读取文件夹。|フォルダーを読み取れませんでした。|फ़ोल्डर पढ़ा नहीं जा सका।
No se pudo abrir este documento.|No s'ha pogut obrir aquest document.|This document could not be opened.|Impossible d'ouvrir ce document.|Dieses Dokument konnte nicht geöffnet werden.|Não foi possível abrir este documento.|Impossibile aprire questo documento.|无法打开文档。|この文書を開けませんでした。|यह दस्तावेज़ खोला नहीं जा सका।
No se pudo completar la operación.|No s'ha pogut completar l'operació.|The operation could not be completed.|Impossible de terminer l'opération.|Der Vorgang konnte nicht abgeschlossen werden.|Não foi possível concluir a operação.|Impossibile completare l'operazione.|无法完成操作。|操作を完了できませんでした。|कार्य पूरा नहीं किया जा सका।
Esta página no tiene texto seleccionable.|Aquesta pàgina no té text seleccionable.|This page has no selectable text.|Cette page n'a pas de texte sélectionnable.|Diese Seite enthält keinen auswählbaren Text.|Esta página não tem texto selecionável.|Questa pagina non ha testo selezionabile.|此页面没有可选择的文本。|このページには選択できるテキストがありません。|इस पृष्ठ में चयन योग्य पाठ नहीं है।
Ver página original|Veure pàgina original|View original page|Voir la page originale|Originalseite ansehen|Ver página original|Vedi pagina originale|查看原始页面|元のページを見る|मूल पृष्ठ देखें
La clave de API no es válida.|La clau d'API no és vàlida.|The API key is invalid.|La clé API est invalide.|Der API-Schlüssel ist ungültig.|A chave de API não é válida.|La chiave API non è valida.|API 密钥无效。|APIキーが無効です。|API कुंजी अमान्य है।
Este navegador no dispone de lectura en voz alta.|Aquest navegador no disposa de lectura en veu alta.|This browser does not support reading aloud.|Ce navigateur ne prend pas en charge la lecture à voix haute.|Dieser Browser unterstützt kein Vorlesen.|Este navegador não suporta leitura em voz alta.|Questo browser non supporta la lettura ad alta voce.|此浏览器不支持朗读。|このブラウザーは読み上げに対応していません。|यह ब्राउज़र सस्वर पठन का समर्थन नहीं करता।
Selecciona un fragmento para anotar, o marca la página actual.|Selecciona un fragment per anotar, o marca la pàgina actual.|Select a passage to annotate, or bookmark the current page.|Sélectionnez un passage à annoter ou marquez la page actuelle.|Wähle eine Passage für eine Notiz oder setze ein Lesezeichen.|Selecione um trecho para anotar ou marque a página atual.|Seleziona un brano da annotare o segna la pagina attuale.|选择文本添加笔记，或为当前页面添加书签。|文章を選択して注釈を付けるか、現在のページにしおりを付けてください。|नोट के लिए अंश चुनें या वर्तमान पृष्ठ चिह्नित करें।
Este libro no incluye una portada identificada.|Aquest llibre no inclou una coberta identificada.|This book has no identified cover.|Ce livre n'a pas de couverture identifiée.|Dieses Buch hat kein erkennbares Cover.|Este livro não tem capa identificada.|Questo libro non ha una copertina identificata.|此书没有识别到封面。|この本には確認できる表紙がありません。|इस पुस्तक में पहचाना गया आवरण नहीं है।
Esta posición ya tiene un marcador.|Aquesta posició ja té un marcador.|This position is already bookmarked.|Cette position est déjà marquée.|Diese Position hat bereits ein Lesezeichen.|Esta posição já tem um marcador.|Questa posizione ha già un segnalibro.|此位置已有书签。|この位置には既にしおりがあります。|इस स्थिति पर पहले से चिह्न है।
Vuelve a elegir el archivo para recuperar sus notas y su posición.|Torna a triar el fitxer per recuperar-ne les notes i la posició.|Choose the file again to restore notes and position.|Choisissez à nouveau le fichier pour retrouver notes et position.|Wähle die Datei erneut, um Notizen und Position wiederherzustellen.|Escolha novamente o ficheiro para recuperar notas e posição.|Scegli di nuovo il file per recuperare note e posizione.|再次选择文件以恢复笔记和位置。|ノートと位置を復元するにはファイルを再選択してください。|नोट और स्थिति वापस पाने के लिए फ़ाइल फिर चुनें।
Abre un libro antes de iniciar la lectura.|Obre un llibre abans de començar la lectura.|Open a book before starting playback.|Ouvrez un livre avant de lancer la lecture.|Öffne vor dem Vorlesen ein Buch.|Abra um livro antes de iniciar a leitura.|Apri un libro prima di avviare la lettura.|开始朗读前请先打开书籍。|読み上げ前に本を開いてください。|पठन शुरू करने से पहले पुस्तक खोलें।
Elige una carpeta para empezar.|Tria una carpeta per començar.|Choose a folder to get started.|Choisissez un dossier pour commencer.|Wähle einen Ordner, um zu beginnen.|Escolha uma pasta para começar.|Scegli una cartella per iniziare.|选择文件夹开始。|フォルダーを選択して開始してください。|शुरू करने के लिए फ़ोल्डर चुनें।
Desvincular carpeta|Desvincular carpeta|Unlink folder|Dissocier le dossier|Ordner trennen|Desassociar pasta|Scollega cartella|取消文件夹关联|フォルダーの関連付けを解除|फ़ोल्डर का लिंक हटाएँ
voces disponibles|veus disponibles|voices available|voix disponibles|verfügbare Stimmen|vozes disponíveis|voci disponibili|可用语音|利用可能な音声|उपलब्ध आवाज़ें
resultados|resultats|results|résultats|Ergebnisse|resultados|risultati|结果|件の結果|परिणाम
libros|llibres|books|livres|Bücher|livros|libri|本书|冊|पुस्तकें
Mostrar más|Mostrar-ne més|Show more|Afficher plus|Mehr anzeigen|Mostrar mais|Mostra altro|显示更多|さらに表示|और दिखाएँ
Metadatos cargados|Metadades carregades|Metadata loaded|Métadonnées chargées|Metadaten geladen|Metadados carregados|Metadati caricati|元数据已加载|メタデータを読み込みました|मेटाडेटा लोड हुआ
Idioma del libro|Idioma del llibre|Book language|Langue du livre|Buchsprache|Idioma do livro|Lingua del libro|书籍语言|本の言語|पुस्तक की भाषा
Detectar del libro|Detectar del llibre|Detect from book|Détecter depuis le livre|Aus Buch erkennen|Detetar do livro|Rileva dal libro|从书籍检测|本から検出|पुस्तक से पहचानें
Las voces de red pueden necesitar conexión.|Les veus de xarxa poden necessitar connexió.|Network voices may need a connection.|Les voix en ligne peuvent nécessiter une connexion.|Online-Stimmen benötigen möglicherweise eine Verbindung.|As vozes de rede podem precisar de ligação.|Le voci online possono richiedere una connessione.|网络语音可能需要联网。|ネットワーク音声には接続が必要な場合があります。|नेटवर्क की आवाज़ों को कनेक्शन चाहिए हो सकता है।
Solo se carga la portada del libro elegido.|Només es carrega la coberta del llibre triat.|Only the chosen book's cover is loaded.|Seule la couverture du livre choisi est chargée.|Nur das Cover des gewählten Buches wird geladen.|Só é carregada a capa do livro escolhido.|Viene caricata solo la copertina del libro scelto.|仅加载所选书籍的封面。|選択した本の表紙のみ読み込みます。|केवल चुनी गई पुस्तक का आवरण लोड होता है।
Abrir esta carpeta|Obrir aquesta carpeta|Open this folder|Ouvrir ce dossier|Diesen Ordner öffnen|Abrir esta pasta|Apri questa cartella|打开此文件夹|このフォルダーを開く|यह फ़ोल्डर खोलें
Documento|Document|Document|Document|Dokument|Documento|Documento|文档|文書|दस्तावेज़
Más formatos|Més formats|More formats|Autres formats|Weitere Formate|Mais formatos|Altri formati|更多格式|その他の形式|और प्रारूप
Cerrar ayuda|Tancar ajuda|Dismiss help|Fermer l'aide|Hilfe schließen|Fechar ajuda|Chiudi aiuto|关闭帮助|ヒントを閉じる|सहायता बंद करें
`
const catalog = new Map((rows.trim() + '\n' + detailRows.trim() + '\n' + releaseRows.trim()).split('\n').map(line => {
  const values = line.split('|')
  if (values.length !== order.length) throw new Error(`Incomplete translation: ${values[0]}`)
  return [values[0], values]
}))
export function t(source, language = active) { return catalog.get(source)?.[order.indexOf(language)] ?? source }
const originals = new WeakMap()
const attributes = new WeakMap()
let observer, root
const excluded = '[data-user-content],script,style,textarea,#reading-area,#toc,#chapter-name,#note-quote,#footnote-content,#dictionary-word,#dictionary-definition,.library-book,.note-link,.resume-button'
function translateNode(node) {
  if (node.nodeType !== 3 || node.parentElement?.closest(excluded)) return
  const stored = originals.get(node)
  const source = stored && node.data === stored.last ? stored.source : node.data
  const trimmed = source.trim(), translated = t(trimmed)
  const value = trimmed ? source.replace(trimmed, translated) : source
  originals.set(node, { source, last: value })
  if (node.data !== value) node.data = value
}
export function translateUI(element = root) {
  if (!element) return
  observer?.disconnect()
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) translateNode(node)
  for (const el of [element, ...element.querySelectorAll('[title],[aria-label],[placeholder]')]) {
    if (el.closest(excluded)) continue
    const map = attributes.get(el) ?? {}
    for (const attribute of ['title','aria-label','placeholder']) {
      if (!el.hasAttribute(attribute)) continue
      const current = el.getAttribute(attribute), prior = map[attribute]
      const source = prior && current === prior.last ? prior.source : current
      const last = t(source)
      map[attribute] = { source, last }
      if (current !== last) el.setAttribute(attribute, last)
    }
    attributes.set(el, map)
  }
  observer?.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title','aria-label','placeholder'] })
}
export function setUILanguage(preference) {
  active = detectLanguage(preference)
  document.documentElement.lang = active
  translateUI()
  return active
}
export function initializeI18n(element, preference) {
  root = element
  observer = new MutationObserver(() => translateUI())
  setUILanguage(preference)
}
export const currentLanguage = () => active
export const translationCount = catalog.size
