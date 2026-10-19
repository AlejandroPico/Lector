package io.github.alejandropico.lector;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.*;
public class NarrationQueueTest {
  private NarrationQueue.Item item(String text,float rate){return new NarrationQueue.Item(text,"es-ES","voice","epubcfi(/6/2)","Capítulo",rate,1,1,120);}
  @Test public void advancesAcrossChaptersWithoutAClient(){NarrationQueue queue=new NarrationQueue(Arrays.asList(item("Uno dos.",1),item("Tres cuatro.",1)));queue.boundary(4);assertTrue(queue.next());assertEquals(0,queue.offset);assertEquals("Tres cuatro.",queue.current().text);assertFalse(queue.next());assertNull(queue.current());}
  @Test public void repeatedRewindsAccumulateAndCrossItems(){String text=String.join(" ",Collections.nCopies(60,"palabra"));NarrationQueue queue=new NarrationQueue(Arrays.asList(item(text,1),item(text,1),item(text,1)));queue.index=2;queue.offset=140;queue.rewind(10000);assertEquals(1,queue.index);int first=queue.offset;queue.rewind(10000);assertEquals(1,queue.index);assertTrue(queue.offset<first);for(int i=0;i<10;i++)queue.rewind(10000);assertEquals(0,queue.index);assertEquals(0,queue.offset);}
  @Test public void timingUsesTheNarrationRateAndNeverSplitsWords(){NarrationQueue.Item slow=item("El jardín está en calma.",1),fast=item("El jardín está en calma.",2);assertEquals(slow.duration/2,fast.duration);assertEquals(3,slow.wordStart(6));}
  @Test public void emptyQueueIsRejected(){try{new NarrationQueue(Collections.emptyList());fail();}catch(IllegalArgumentException expected){}}
}
