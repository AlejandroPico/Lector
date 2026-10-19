package io.github.alejandropico.lector;

import java.text.BreakIterator;
import java.util.*;

/** The playback cursor lives outside the WebView. Times for TTS are estimates. */
final class NarrationQueue {
  static final class Item {
    final String text, language, voice, cfi, chapter;
    final float rate, pitch, volume;
    String characterId="narrator";
    final long duration;
    Item(String text,String language,String voice,String cfi,String chapter,float rate,float pitch,float volume,int wpm) {
      this.text=text;this.language=language;this.voice=voice;this.cfi=cfi;this.chapter=chapter;
      this.rate=rate;this.pitch=pitch;this.volume=volume;
      BreakIterator words=BreakIterator.getWordInstance(Locale.forLanguageTag(language));words.setText(text);
      int count=0,start=words.first();for(int end=words.next();end!=BreakIterator.DONE;start=end,end=words.next())if(text.substring(start,end).codePoints().anyMatch(Character::isLetterOrDigit))count++;
      duration=Math.max(300,Math.round(count*60000.0/Math.max(80,wpm)/rate));
    }
    int wordStart(int at) {
      at=Math.min(text.length(),Math.max(0,at));
      if(at==text.length())return at;
      BreakIterator words=BreakIterator.getWordInstance(Locale.forLanguageTag(language));words.setText(text);
      return words.isBoundary(at)?at:Math.max(0,words.preceding(at));
    }
  }
  final List<Item> items;
  int index=0,offset=0;
  NarrationQueue(List<Item> items){if(items.isEmpty())throw new IllegalArgumentException("Empty narration");this.items=new ArrayList<>(items);}
  Item current(){return index<items.size()?items.get(index):null;}
  void boundary(int at){if(current()!=null)offset=Math.max(0,Math.min(current().text.length(),at));}
  boolean next(){offset=0;return ++index<items.size();}
  void rewind(long milliseconds) {
    if(current()==null){index=items.size()-1;offset=current().text.length();}
    long position=Math.round(current().duration*(double)offset/Math.max(1,current().text.length()))-Math.max(0,milliseconds);
    while(position<0&&index>0){index--;position+=current().duration;}
    offset=current().wordStart((int)Math.round(Math.max(0,position)*(double)current().text.length()/current().duration));
  }
}
